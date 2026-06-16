import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import { askMergeAI } from '../services/ai.service';

export const getWorkspace = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    let workspace = await prisma.buildWorkspace.findUnique({
      where: { chatId },
      include: { 
        tasks: true,
        updates: {
          include: { author: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!workspace) {
      // Pro Gate: Check if at least one participant is a Pro user before creating
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { participants: { select: { plan: true } } }
      });

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      const hasProUser = chat.participants.some((user: any) => user.plan === 'pro');
      if (!hasProUser) {
        return res.status(403).json({ error: 'Pro plan required to create a Build Workspace' });
      }

      workspace = await prisma.buildWorkspace.create({
        data: {
          chatId,
          goal: "",
          user1Role: "Frontend",
          user2Role: "Backend",
        },
        include: { 
          tasks: true,
          updates: {
            include: { author: true }
          }
        }
      });
    }

    res.json(workspace);
  } catch (error) {
    console.error('Error in getWorkspace:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateWorkspaceGoal = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { goal } = req.body;
    
    const workspace = await prisma.buildWorkspace.update({
      where: { chatId },
      data: { goal },
      include: { tasks: true }
    });

    res.json(workspace);
  } catch (error) {
    console.error('Error in updateWorkspaceGoal:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateWorkspaceRoles = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { user1Role, user2Role } = req.body;
    
    const workspace = await prisma.buildWorkspace.update({
      where: { chatId },
      data: { user1Role, user2Role },
      include: { tasks: true }
    });

    res.json(workspace);
  } catch (error) {
    console.error('Error in updateWorkspaceRoles:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;
    
    const workspace = await prisma.buildWorkspace.findUnique({ where: { chatId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const task = await prisma.buildWorkspaceTask.create({
      data: {
        workspaceId: workspace.id,
        text,
        status: "todo"
      }
    });

    res.json(task);
  } catch (error) {
    console.error('Error in createTask:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    
    const task = await prisma.buildWorkspaceTask.update({
      where: { id: taskId },
      data: { status }
    });

    res.json(task);
  } catch (error) {
    console.error('Error in updateTaskStatus:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createWorkspaceUpdate = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    // @ts-ignore
    const userId = req.userId;
    
    const workspace = await prisma.buildWorkspace.findUnique({ where: { chatId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const update = await prisma.buildWorkspaceUpdate.create({
      data: {
        workspaceId: workspace.id,
        authorId: userId,
        content
      },
      include: { author: true }
    });

    res.json(update);
  } catch (error) {
    console.error('Error in createWorkspaceUpdate:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const saveWorkspaceCode = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { code, language } = req.body;
    
    const workspace = await prisma.buildWorkspace.update({
      where: { chatId },
      data: { code, language }
    });

    res.json(workspace);
  } catch (error) {
    console.error('Error in saveWorkspaceCode:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const askMergeAIEndpoint = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { prompt, codeContext, language } = req.body;
    
    const workspace = await prisma.buildWorkspace.findUnique({ where: { chatId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Ensure the AI call isn't abused
    // @ts-ignore
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    
    if (user?.plan !== 'pro') {
      return res.status(403).json({ error: 'Merge Pro required for AI assistant' });
    }
    
    const responseText = await askMergeAI(prompt, codeContext, language);

    res.json({ text: responseText });
  } catch (error) {
    console.error('Error in askMergeAIEndpoint:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
};
