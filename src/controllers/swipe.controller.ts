import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import { sendMatchEmail } from '../services/emailService';
import { NotificationService } from '../services/notification.service';
import { calculateCompatibility } from '../services/compatibility.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJson(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

function stripPassword(user: any) {
  const { password, ...safe } = user;
  return safe;
}

// ─── GET /swipe/feed ──────────────────────────────────────────────────────────

export const getSwipeFeed = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const skills        = req.query.skills        as string | undefined;
    const intent        = req.query.intent        as string | undefined;
    const experienceLevel = req.query.experienceLevel as string | undefined;

    // 1. Collect IDs to exclude
    const [likedIds, skippedIds] = await Promise.all([
      prisma.like.findMany({ where: { senderId: currentUserId }, select: { receiverId: true } })
        .then(rows => rows.map(r => r.receiverId)),
      prisma.skip.findMany({ where: { senderId: currentUserId }, select: { receiverId: true } })
        .then(rows => rows.map(r => r.receiverId)),
    ]);

    const excludedIds = [currentUserId, ...likedIds, ...skippedIds];

    // 2. Build filter
    const where: any = { id: { notIn: excludedIds } };
    if (skills) {
      const arr = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) where.skills = { hasSome: arr };
    }
    if (intent)          where.intent          = intent;
    if (experienceLevel) where.experienceLevel = experienceLevel;

    // 3. Fetch candidates + current user in parallel
    const [candidates, currentUser] = await Promise.all([
      prisma.user.findMany({ where, take: 30, orderBy: { createdAt: 'desc' } }),
      prisma.user.findUnique({ where: { id: currentUserId } }),
    ]);

    // 4. Score & sort
    const scored = candidates.map(user => {
      const result = currentUser
        ? calculateCompatibility(
            {
              ...currentUser,
              projects: safeJson(currentUser.projects),
              activity: safeJson(currentUser.activity),
            },
            {
              ...user,
              projects: safeJson(user.projects),
              activity: safeJson(user.activity),
            },
          )
        : { score: 0, breakdown: {}, matchReasons: [], algorithmVersion: 'v1-rule-based' as const };

      let finalScore = result.score;
      const isCurrentlyBoosted = user.isBoosted && user.boostExpiresAt && new Date(user.boostExpiresAt) > new Date();
      if (isCurrentlyBoosted) {
        finalScore += 200; // Boosted ranking score
      }

      return {
        ...stripPassword(user),
        compatibilityScore: finalScore,
        matchReasons:       result.matchReasons,
        compatibilityBreakdown: result.breakdown,
        algorithmVersion:   result.algorithmVersion,
        isBoosted: isCurrentlyBoosted,
      };
    });

    // Sort by score descending so best matches appear first
    scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    res.status(200).json(scored.slice(0, 20));
  } catch (error) {
    console.error('Get swipe feed error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /swipe/recommended ───────────────────────────────────────────────────
// Returns top-N pre-scored recommendations for the "Recommended Builders" section.

export const getRecommended = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const limit = Math.min(Number(req.query.limit) || 6, 12);

    // Exclude already-liked / skipped / matched users
    const [likedIds, skippedIds, matchedIds] = await Promise.all([
      prisma.like.findMany({ where: { senderId: currentUserId }, select: { receiverId: true } })
        .then(r => r.map(x => x.receiverId)),
      prisma.skip.findMany({ where: { senderId: currentUserId }, select: { receiverId: true } })
        .then(r => r.map(x => x.receiverId)),
      prisma.match.findMany({
        where: { OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }] },
        select: { user1Id: true, user2Id: true },
      }).then(rows => rows.flatMap(r => [r.user1Id, r.user2Id])),
    ]);

    const excludedIds = [...new Set([currentUserId, ...likedIds, ...skippedIds, ...matchedIds])];

    const [candidates, currentUser] = await Promise.all([
      prisma.user.findMany({
        where: { id: { notIn: excludedIds } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findUnique({ where: { id: currentUserId } }),
    ]);

    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const scored = candidates
      .map(user => {
        const result = calculateCompatibility(
          {
            ...currentUser,
            projects: safeJson(currentUser.projects),
            activity: safeJson(currentUser.activity),
          },
          {
            ...user,
            projects: safeJson(user.projects),
            activity: safeJson(user.activity),
          },
        );

        let finalScore = result.score;
        const isCurrentlyBoosted = user.isBoosted && user.boostExpiresAt && new Date(user.boostExpiresAt) > new Date();
        if (isCurrentlyBoosted) {
          finalScore += 200; // Boosted ranking score
        }

        return {
          ...stripPassword(user),
          compatibilityScore:     finalScore,
          matchReasons:           result.matchReasons,
          compatibilityBreakdown: result.breakdown,
          algorithmVersion:       result.algorithmVersion,
          isBoosted:              isCurrentlyBoosted,
        };
      })
      .filter(u => u.compatibilityScore > 0)          // Only meaningful matches
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    res.status(200).json(scored);
  } catch (error) {
    console.error('Get recommended error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /swipe/right ────────────────────────────────────────────────────────

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

    await prisma.like.create({ data: { senderId, receiverId } });

    const mutualLike = await prisma.like.findUnique({
      where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } } as any
    });

    if (mutualLike) {
      const chat = await prisma.chat.create({
        data: {
          participants: { connect: [{ id: senderId }, { id: receiverId }] }
        }
      });

      const match = await prisma.match.create({
        data: { user1Id: senderId, user2Id: receiverId, chatId: chat.id },
        include: { user1: true, user2: true }
      });

      const user1 = match.user1;
      const user2 = match.user2;

      sendMatchEmail(user1.email, user1.name, user2.name).catch(console.error);
      sendMatchEmail(user2.email, user2.name, user1.name).catch(console.error);

      const io = req.app.get('io');

      await NotificationService.createNotification(io, {
        recipientId: user1.id,
        senderId:    user2.id,
        type:        'match',
        message:     `❤️ ${user2.name} matched with you`,
        entityId:    match.id,
      });

      await NotificationService.createNotification(io, {
        recipientId: user2.id,
        senderId:    user1.id,
        type:        'match',
        message:     `❤️ ${user1.name} matched with you`,
        entityId:    match.id,
      });

      if (io) {
        const u1Safe = { id: user1.id, name: user1.name, avatar: user1.avatar, status: user1.status };
        const u2Safe = { id: user2.id, name: user2.name, avatar: user2.avatar, status: user2.status };
        io.to(senderId).emit('match_created', { id: match.id, chatId: chat.id, matchedAt: match.createdAt, user: u2Safe });
        io.to(receiverId).emit('match_created', { id: match.id, chatId: chat.id, matchedAt: match.createdAt, user: u1Safe });
      }

      return res.status(200).json({
        isMatch: true,
        match: {
          ...match,
          chatId: chat.id,
          user: match.user1Id === senderId ? match.user2 : match.user1,
        },
      });
    }

    res.status(200).json({ isMatch: false, message: 'Like sent' });
  } catch (error) {
    console.error('Swipe right error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /swipe/left ─────────────────────────────────────────────────────────

export const swipeLeft = async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).userId;
    if (!senderId) return res.status(401).json({ message: 'Unauthorized' });

    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'Receiver ID is required' });

    await prisma.skip.upsert({
      where:  { senderId_receiverId: { senderId, receiverId } } as any,
      update: {},
      create: { senderId, receiverId },
    });

    res.status(200).json({ message: 'User skipped' });
  } catch (error) {
    console.error('Swipe left error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
