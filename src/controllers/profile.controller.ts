import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import logger from '../Config/logger';

export const getProfileInsights = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).userId;

    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Only PRO users can view insights (or the owner themselves)
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isPro = currentUser.plan === 'pro';
    const isOwner = currentUserId === userId;

    if (!isPro && !isOwner) {
      res.status(403).json({ success: false, message: 'Upgrade to Pro to view Cofounder Insights' });
      return;
    }

    const profileUser = await prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        reliabilityScore: true,
        responseTime: true,
        projectCompletionRate: true,
        builderRating: true,
        activityLevel: true,
        githubData: true,
        githubVerified: true
      }
    });

    if (!profileUser) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Determine consistency string
    let consistency = "Medium";
    if (profileUser.githubVerified && profileUser.githubData) {
       const data: any = profileUser.githubData;
       if (data.contributionsLastYear > 500) consistency = "High";
       else if (data.contributionsLastYear > 100) consistency = "Medium";
       else consistency = "Low";
    }

    res.status(200).json({
      success: true,
      data: {
        reliabilityScore: profileUser.reliabilityScore || 85, // Fallback if 0
        responseTime: profileUser.responseTime || '2h',
        projectCompletionRate: profileUser.projectCompletionRate || '0/0',
        builderRating: profileUser.builderRating || 4.5, // Fallback
        activityLevel: profileUser.activityLevel || 'Active',
        githubConsistency: consistency
      }
    });
  } catch (error) {
    logger.error('Error fetching profile insights:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch insights' });
  }
};
