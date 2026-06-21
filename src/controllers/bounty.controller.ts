import { Request, Response } from 'express';
import prisma from '../Config/prisma';

export const getAllBounties = async (req: Request, res: Response) => {
  try {
    const bounties = await prisma.bounty.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        submissions: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    res.json(bounties);
  } catch (error) {
    console.error('Error fetching bounties:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createBounty = async (req: Request, res: Response) => {
  try {
    const { title, description, amount, skills } = req.body;
    // @ts-ignore
    const ownerId = req.userId;

    const bounty = await prisma.bounty.create({
      data: {
        title,
        description,
        amount: parseFloat(amount),
        skills: skills || [],
        ownerId,
        status: 'Open'
      },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        submissions: {
          include: { user: { select: { id: true, name: true, avatar: true } } }
        }
      }
    });

    res.status(201).json(bounty);
  } catch (error) {
    console.error('Error creating bounty:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const applyForBounty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const bounty = await prisma.bounty.findUnique({ where: { id } });
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.status !== 'Open') return res.status(400).json({ error: 'Bounty is not open' });

    // Instantly assign the bounty to the applicant
    const updatedBounty = await prisma.bounty.update({
      where: { id },
      data: {
        status: 'In Progress',
        assigneeId: userId
      },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      }
    });

    res.json(updatedBounty);
  } catch (error) {
    console.error('Error applying for bounty:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const submitBounty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { solutionLink } = req.body;
    const userId = (req as any).userId;

    const bounty = await prisma.bounty.findUnique({ where: { id } });
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.assigneeId !== userId) return res.status(403).json({ error: 'You are not assigned to this bounty' });
    if (bounty.status !== 'In Progress') return res.status(400).json({ error: 'Bounty is not in progress' });

    const updatedBounty = await prisma.bounty.update({
      where: { id },
      data: {
        status: 'In Review',
        solutionLink
      },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      }
    });

    res.json(updatedBounty);
  } catch (error) {
    console.error('Error submitting bounty:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const completeBounty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const bounty = await prisma.bounty.findUnique({ 
      where: { id },
      include: { owner: true }
    });

    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.ownerId !== userId) return res.status(403).json({ error: 'Only the owner can complete the bounty' });
    if (bounty.status !== 'In Review') return res.status(400).json({ error: 'Bounty is not in review' });

    // Platform fee logic
    const isPro = bounty.owner.plan === 'pro';
    const platformFeePercentage = isPro ? 0 : 0.10;
    const platformFeeAmount = bounty.amount * platformFeePercentage;
    const finalPayout = bounty.amount - platformFeeAmount;

    // Complete bounty
    const updatedBounty = await prisma.bounty.update({
      where: { id },
      data: { 
        status: 'Completed'
      },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      }
    });

    res.json({
      ...updatedBounty,
      financials: {
        totalAmount: bounty.amount,
        platformFeePercentage: platformFeePercentage * 100,
        platformFeeAmount,
        finalPayout
      }
    });
  } catch (error) {
    console.error('Error completing bounty:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
