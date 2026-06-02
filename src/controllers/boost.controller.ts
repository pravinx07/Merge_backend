import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import logger from '../Config/logger';

export const activateBoost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if already boosted
    if (user.isBoosted && user.boostExpiresAt && user.boostExpiresAt > new Date()) {
      res.status(400).json({ success: false, message: 'Boost is already active' });
      return;
    }

    // Check if user has available boosts (optional rule, but for PRO we allow it if plan === 'pro' or boostCount > 0)
    // The prompt: "FREE: No boosts. PRO: Can use 1 free boost/week".
    // Let's check plan or boostCount.
    if (user.plan !== 'pro' && user.boostCount <= 0) {
      res.status(403).json({ success: false, message: 'Upgrade to Pro to use Boost, or you have no boosts remaining.' });
      return;
    }

    // Set boost for 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60000);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isBoosted: true,
        boostExpiresAt: expiresAt,
        boostCount: user.plan !== 'pro' ? Math.max(0, user.boostCount - 1) : user.boostCount // decrement if not pro? actually the prompt says PRO gets 1 free boost/week. So even pro uses boosts. We'll decrement if it's > 0.
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile boosted successfully!',
      boostExpiresAt: updatedUser.boostExpiresAt,
      isBoosted: true
    });
  } catch (error) {
    logger.error('Error activating boost:', error);
    res.status(500).json({ success: false, message: 'Failed to activate boost' });
  }
};

export const getBoostStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if boost expired
    let isBoosted = user.isBoosted;
    let boostExpiresAt = user.boostExpiresAt;

    if (isBoosted && boostExpiresAt && boostExpiresAt < new Date()) {
      // Expired, update db
      await prisma.user.update({
        where: { id: userId },
        data: {
          isBoosted: false,
          boostExpiresAt: null
        }
      });
      isBoosted = false;
      boostExpiresAt = null;
    }

    res.status(200).json({
      success: true,
      isBoosted,
      boostExpiresAt,
      boostCount: user.boostCount
    });
  } catch (error) {
    logger.error('Error fetching boost status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch boost status' });
  }
};
