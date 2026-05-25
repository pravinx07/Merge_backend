import { Request, Response } from 'express';
import prisma from '../Config/prisma';

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
