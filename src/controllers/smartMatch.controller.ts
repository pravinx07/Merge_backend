import { Request, Response } from 'express';
import prisma from '../Config/prisma';
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

// ─── GET /api/matches/smart ───────────────────────────────────────────────────
// PRO-gated AI Smart Match recommendations with full breakdown.
// Free users receive a teaser (top 2, blurred on the frontend).
// Pro users receive the full top-10.

export const getSmartMatches = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).userId;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const isPro = currentUser.plan === 'pro';

    // Exclude already-interacted users
    const [likedIds, skippedIds, matchedIds] = await Promise.all([
      prisma.like
        .findMany({ where: { senderId: currentUserId }, select: { receiverId: true } })
        .then(r => r.map(x => x.receiverId)),
      prisma.skip
        .findMany({ where: { senderId: currentUserId }, select: { receiverId: true } })
        .then(r => r.map(x => x.receiverId)),
      prisma.match
        .findMany({
          where: { OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }] },
          select: { user1Id: true, user2Id: true },
        })
        .then(rows => rows.flatMap(r => [r.user1Id, r.user2Id])),
    ]);

    const excludedIds = [...new Set([currentUserId, ...likedIds, ...skippedIds, ...matchedIds])];

    // Fetch a larger candidate pool for better scoring
    const candidates = await prisma.user.findMany({
      where: { id: { notIn: excludedIds } },
      take: 80,
      orderBy: { builderScore: 'desc' }, // Prefer active builders
    });

    // Score all candidates
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

        return {
          ...stripPassword(user),
          compatibilityScore: result.score,
          matchReasons: result.matchReasons,
          compatibilityBreakdown: result.breakdown,
          algorithmVersion: result.algorithmVersion,
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // PRO: full top-10 | Free: top-3 teaser (frontend blurs them)
    const limit = isPro ? 10 : 3;
    const results = scored.slice(0, limit);

    res.status(200).json({
      isPro,
      totalCandidates: scored.length,
      matches: results,
      algorithmVersion: 'v1-rule-based',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get smart matches error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
