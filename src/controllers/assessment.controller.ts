import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import logger from '../Config/logger';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY });

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
  res.json(ASSESSMENTS);
};

export const submitAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    // @ts-ignore
    const userId = req.userId;

    const assessment = ASSESSMENTS.find(a => a.id === id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.verifiedSkills.includes(assessment.skill)) {
      return res.status(400).json({ error: 'Skill already verified' });
    }

    // Use Gemini to evaluate the code
    const prompt = `You are an automated coding assessment grader.
    The task was: "${assessment.description}"
    The user submitted the following code in ${assessment.language}:
    \`\`\`${assessment.language}
    ${code}
    \`\`\`
    
    Evaluate if the code correctly solves the problem. 
    Respond with ONLY a JSON object in this exact format:
    {"passed": true/false, "feedback": "Your feedback here"}
    Do not wrap it in markdown block quotes, just raw JSON.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const responseText = aiResponse.text || '{}';
    // Clean up potential markdown formatting if the model disobeys
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let evaluation = { passed: false, feedback: 'Failed to parse AI response' };
    try {
      evaluation = JSON.parse(cleanJson);
    } catch (e) {
      logger.error('Failed to parse AI evaluation JSON:', cleanJson);
    }

    if (evaluation.passed) {
      // Add to verified skills
      await prisma.user.update({
        where: { id: userId },
        data: {
          verifiedSkills: { push: assessment.skill },
          builderScore: { increment: 50 } // Reward for passing
        }
      });
    }

    res.json({
      passed: evaluation.passed,
      feedback: evaluation.feedback,
      skill: assessment.skill
    });

  } catch (error) {
    logger.error('Error in submitAssessment:', error);
    res.status(500).json({ error: 'Server error during assessment evaluation' });
  }
};
