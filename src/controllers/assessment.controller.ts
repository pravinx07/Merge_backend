import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import logger from '../Config/logger';

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  logger.warn('Missing GOOGLE_API_KEY or GEMINI_API_KEY environment variable. Assessments will fail.');
}
const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

const ASSESSMENTS = [
  {
    id: 'react-basics',
    title: 'React Fundamentals',
    skill: 'React',
    description: 'Create a simple counter component that increments and decrements a value.',
    timeLimitMinutes: 15,
    language: 'javascript'
  },
  {
    id: 'node-api',
    title: 'Node.js Express API',
    skill: 'Node.js',
    description: 'Write an Express route handler that accepts a POST request with a JSON body containing a "name" and returns a 200 response with "Hello, {name}".',
    timeLimitMinutes: 15,
    language: 'javascript'
  },
  {
    id: 'python-algo',
    title: 'Python Algorithms',
    skill: 'Python',
    description: 'Write a Python function `two_sum(nums, target)` that returns the indices of the two numbers such that they add up to target.',
    timeLimitMinutes: 15,
    language: 'python'
  }
];

export const getAssessments = (req: Request, res: Response) => {
  res.json([]);
};

export const generateAssessment = async (req: Request, res: Response) => {
  try {
    const { skill } = req.body;
    if (!skill) return res.status(400).json({ error: 'Skill is required' });

    const prompt = `You are a technical interviewer. Generate a short, practical coding challenge to test a developer's proficiency in "${skill}".
    The challenge should take about 15 minutes to solve.
    Respond with ONLY a JSON object in this exact format:
    {"title": "Short Title", "description": "Detailed task description", "language": "javascript", "timeLimitMinutes": 15}
    Do not wrap it in markdown block quotes.`;

    const aiPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('AI Request Timeout')), 15000)
    );

    const aiResponse = await Promise.race([aiPromise, timeoutPromise]);
    const cleanJson = (aiResponse.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(cleanJson);
    
    res.json({
      id: Date.now().toString(),
      skill,
      title: parsed.title || `${skill} Challenge`,
      description: parsed.description || `Write a program using ${skill}.`,
      language: parsed.language || 'javascript',
      timeLimitMinutes: parsed.timeLimitMinutes || 15
    });

  } catch (error) {
    logger.error('Error generating assessment:', error);
    res.status(500).json({ error: 'Failed to generate assessment' });
  }
};

export const submitAssessment = async (req: Request, res: Response) => {
  try {
    const { skill, description, language, code } = req.body;
    // @ts-ignore
    const userId = req.userId;

    if (!skill || !description || !language || !code) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI Verification service is not configured' });
    }

    if (user.verifiedSkills.includes(skill)) {
      return res.status(400).json({ error: 'Skill already verified' });
    }

    // Use Gemini to evaluate the code
    const prompt = `You are an automated coding assessment grader.
    The task was: "${description}"
    The user submitted the following code in ${language}:
    \`\`\`${language}
    ${code}
    \`\`\`
    
    Evaluate if the code correctly solves the problem. 
    Respond with ONLY a JSON object in this exact format:
    {"passed": true/false, "feedback": "Your feedback here"}
    Do not wrap it in markdown block quotes, just raw JSON.`;

    const aiPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            passed: { type: "BOOLEAN" as any },
            feedback: { type: "STRING" as any }
          },
          required: ["passed", "feedback"]
        }
      }
    });
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('AI Request Timeout')), 15000)
    );

    const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

    const responseText = aiResponse.text || '{}';
    // Clean up potential markdown formatting if the model disobeys
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let evaluation = { passed: false, feedback: 'Failed to parse AI response' };
    try {
      const parsed = JSON.parse(cleanJson);
      evaluation.feedback = parsed.feedback || '';
      
      // Validate and normalize boolean
      if (typeof parsed.passed === 'string') {
        evaluation.passed = parsed.passed.toLowerCase() === 'true';
      } else {
        evaluation.passed = Boolean(parsed.passed);
      }
    } catch (e) {
      logger.error('Failed to parse AI evaluation JSON:', cleanJson);
    }

    if (evaluation.passed === true) {
      // Add to verified skills atomically using updateMany to prevent race conditions
      await prisma.user.updateMany({
        where: { 
          id: userId,
          NOT: {
            verifiedSkills: { has: skill }
          }
        },
        data: {
          verifiedSkills: { push: skill },
          builderScore: { increment: 50 } // Reward for passing
        }
      });
    }

    res.json({
      passed: evaluation.passed,
      feedback: evaluation.feedback,
      skill: skill
    });

  } catch (error) {
    logger.error('Error in submitAssessment:', error);
    res.status(500).json({ error: 'Server error during assessment evaluation' });
  }
};
