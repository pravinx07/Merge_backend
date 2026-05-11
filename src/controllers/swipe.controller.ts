import { Request, Response } from 'express';
import prisma from '../Config/prisma';

export const getSwipeFeed = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const skills = req.query.skills as string | undefined;
    const intent = req.query.intent as string | undefined;
    const experienceLevel = req.query.experienceLevel as string | undefined;

    // 1. Get IDs to exclude
    const likedUserIds = await prisma.like.findMany({
      where: { senderId: currentUserId },
      select: { receiverId: true }
    }).then(likes => likes.map(l => l.receiverId));

    const skippedUserIds = await prisma.skip.findMany({
      where: { senderId: currentUserId },
      select: { receiverId: true }
    }).then(skips => skips.map(s => s.receiverId));

    const excludedIds = [currentUserId, ...likedUserIds, ...skippedUserIds];

    // 2. Build filter
    const where: any = {
      id: {
        notIn: excludedIds
      }
    };

    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        where.skills = { hasSome: skillsArray };
      }
    }

    if (intent) where.intent = intent;
    if (experienceLevel) where.experienceLevel = experienceLevel;

    // 3. Fetch
    const users = await prisma.user.findMany({
      where,
      take: 20,
      orderBy: { createdAt: 'desc' }
    });

    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });

    // 4. Transform
    const usersWithScore = users.map(user => {
      let score = 0;
      if (currentUser) {
        const uSkills = user.skills || [];
        const cSkills = currentUser.skills || [];
        const sharedSkills = uSkills.filter(s => cSkills.includes(s));
        const totalSkills = Array.from(new Set([...uSkills, ...cSkills])).length;
        if (totalSkills > 0) score += (sharedSkills.length / totalSkills) * 40;

        const uInterests = user.interests || [];
        const cInterests = currentUser.interests || [];
        const sharedInterests = uInterests.filter(i => cInterests.includes(i));
        const totalInterests = Array.from(new Set([...uInterests, ...cInterests])).length;
        if (totalInterests > 0) score += (sharedInterests.length / totalInterests) * 30;

        if (user.intent && currentUser.intent && user.intent === currentUser.intent) score += 20;
        if (user.location && currentUser.location && user.location.toLowerCase() === currentUser.location.toLowerCase()) score += 10;
      }

      const { password, ...userSafe } = user as any;
      return {
        ...userSafe,
        compatibilityScore: Math.round(score) || 0
      };
    });

    res.status(200).json(usersWithScore);
  } catch (error) {
    console.error('Get swipe feed error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const swipeRight = async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).userId;
    if (!senderId) return res.status(401).json({ message: 'Unauthorized' });

    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'Receiver ID is required' });

    if (senderId === receiverId) {
      return res.status(400).json({ message: "You can't match with yourself" });
    }

    const existingLike = await prisma.like.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } } as any
    });

    if (existingLike) return res.status(200).json({ isMatch: false, message: 'Already liked' });

    await prisma.like.create({
      data: { senderId, receiverId }
    });

    const mutualLike = await prisma.like.findUnique({
      where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } } as any
    });

    if (mutualLike) {
      const chat = await prisma.chat.create({
        data: {
          participants: {
            connect: [{ id: senderId }, { id: receiverId }]
          }
        }
      });

      const match = await prisma.match.create({
        data: {
          user1Id: senderId,
          user2Id: receiverId,
          chatId: chat.id
        },
        include: {
          user1: true,
          user2: true
        }
      });

      return res.status(200).json({
        isMatch: true,
        match: {
          ...match,
          chatId: chat.id,
          user: match.user1Id === senderId ? match.user2 : match.user1
        }
      });
    }

    res.status(200).json({ isMatch: false, message: 'Like sent' });
  } catch (error) {
    console.error('Swipe right error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const swipeLeft = async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).userId;
    if (!senderId) return res.status(401).json({ message: 'Unauthorized' });

    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'Receiver ID is required' });

    await prisma.skip.upsert({
      where: { senderId_receiverId: { senderId, receiverId } } as any,
      update: {},
      create: { senderId, receiverId }
    });

    res.status(200).json({ message: 'User skipped' });
  } catch (error) {
    console.error('Swipe left error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
