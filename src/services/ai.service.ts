import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import logger from '../Config/logger';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY });

export const askMergeAI = async (prompt: string, codeContext: string, language: string) => {
  try {
    const fullPrompt = `You are MergeAI, an expert AI pair programmer integrated into a collaborative developer workspace. 
You are currently reviewing code in ${language}.
The user has asked you a question or given an instruction. 
Be concise, extremely helpful, and provide code snippets where appropriate using markdown formatting.
If the code is empty, simply guide them on how to start.

CURRENT CODE CONTEXT:
\`\`\`${language}
${codeContext}
\`\`\`

USER PROMPT:
${prompt}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: fullPrompt,
    });

    return response.text;
  } catch (error) {
    logger.error('Error in MergeAI Service:', error);
    throw new Error('Failed to generate AI response');
  }
};
