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
    // @ts-ignore
    const userId = req.userId;

    const bounty = await prisma.bounty.findUnique({ where: { id } });
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.status !== 'Open') return res.status(400).json({ error: 'Bounty is not open' });

    // Let developers "apply" by just showing interest, but don't close the gig.
    // In this multiple submission model, we might just use submit directly, but we can keep apply as a "watch/interest" flag if needed.
    // For now, we don't strictly need it, but we'll return the bounty as-is or remove this route.
    res.json(bounty);
  } catch (error) {
    console.error('Error applying for bounty:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const submitBounty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { solutionLink } = req.body;
    // @ts-ignore
    const userId = req.userId;

    const bounty = await prisma.bounty.findUnique({ where: { id } });
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.status !== 'Open') return res.status(400).json({ error: 'Bounty is not open for submissions' });

    // Check if user already submitted
    const existing = await prisma.bountySubmission.findFirst({
      where: { bountyId: id, userId }
    });
    if (existing) return res.status(400).json({ error: 'You have already submitted a solution for this gig' });

    // Create submission
    await prisma.bountySubmission.create({
      data: {
        bountyId: id,
        userId,
        solutionLink,
        status: 'Pending'
      }
    });

    const updatedBounty = await prisma.bounty.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        submissions: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    res.json(updatedBounty);
  } catch (error) {
    console.error('Error submitting bounty:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const acceptSubmission = async (req: Request, res: Response) => {
  try {
    const { id, submissionId } = req.params;
    // @ts-ignore
    const userId = req.userId;

    const bounty = await prisma.bounty.findUnique({ 
      where: { id },
      include: { owner: true }
    });

    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.ownerId !== userId) return res.status(403).json({ error: 'Only the owner can accept submissions' });

    const submission = await prisma.bountySubmission.findUnique({ where: { id: submissionId } });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // Platform fee logic based on Monetization
    const isPro = bounty.owner.plan === 'pro';
    const platformFeePercentage = isPro ? 0 : 0.10;
    const platformFeeAmount = bounty.amount * platformFeePercentage;
    const finalPayout = bounty.amount - platformFeeAmount;

    // Update submission status
    await prisma.bountySubmission.update({
      where: { id: submissionId },
      data: { status: 'Accepted' }
    });

    // Complete bounty
    const updatedBounty = await prisma.bounty.update({
      where: { id },
      data: { 
        status: 'Completed',
        assigneeId: submission.userId,
        solutionLink: submission.solutionLink
      },
      include: {
        owner: { select: { id: true, name: true, avatar: true, plan: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        submissions: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        }
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
    console.error('Error accepting submission:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
