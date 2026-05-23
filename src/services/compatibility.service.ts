/**
 * Merge Compatibility Engine — V1 (Rule-Based)
 *
 * Scoring Dimensions:
 *  1. Skills Match       — 30%
 *  2. Project Similarity — 20%
 *  3. Intent Match       — 20%
 *  4. GitHub Similarity  — 15%
 *  5. Hackathon Interest — 10%
 *  6. Location Match     —  5%
 *
 * V2 will replace this with OpenAI embeddings + graph recommendations.
 */

export interface MatchReason {
  icon: string;
  label: string;
  category: 'skills' | 'projects' | 'intent' | 'github' | 'hackathon' | 'location';
}

export interface CompatibilityResult {
  score: number;       // 0–100
  breakdown: {
    skills: number;
    projects: number;
    intent: number;
    github: number;
    hackathon: number;
    location: number;
  };
  matchReasons: MatchReason[];
  algorithmVersion: 'v1-rule-based';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return intersection.length / union.size;
}

function normalise(value: number, max: number): number {
  return Math.min(1, Math.max(0, value / max));
}

// ─── Sub-scorers ──────────────────────────────────────────────────────────────

function scoreSkills(
  currentSkills: string[],
  targetSkills: string[],
): { raw: number; sharedSkills: string[] } {
  const c = currentSkills.map(s => s.toLowerCase());
  const t = targetSkills.map(s => s.toLowerCase());
  const shared = c.filter(s => t.includes(s));
  const jaccard = jaccardSimilarity(c, t);
  return { raw: jaccard, sharedSkills: shared };
}

function scoreProjects(
  currentProjects: any[],
  targetProjects: any[],
): { raw: number; sharedTech: string[] } {
  if (!currentProjects?.length || !targetProjects?.length) return { raw: 0, sharedTech: [] };

  const extractTech = (projects: any[]): string[] =>
    projects.flatMap((p: any) => {
      const stack = p.techStack || p.tech || p.technologies || [];
      return Array.isArray(stack) ? stack.map((t: string) => t.toLowerCase()) : [];
    });

  const cTech = extractTech(currentProjects);
  const tTech = extractTech(targetProjects);
  const shared = [...new Set(cTech.filter(t => tTech.includes(t)))];
  const jaccard = jaccardSimilarity(cTech, tTech);
  return { raw: jaccard, sharedTech: shared };
}

function scoreIntent(currentIntent: string | null, targetIntent: string | null): number {
  if (!currentIntent || !targetIntent) return 0;
  return currentIntent.toLowerCase() === targetIntent.toLowerCase() ? 1 : 0;
}

function scoreGitHub(currentGhData: any, targetGhData: any): {
  raw: number;
  activitySimilarity: 'high' | 'medium' | 'low' | 'none';
} {
  if (!currentGhData || !targetGhData) return { raw: 0, activitySimilarity: 'none' };

  try {
    const cData = typeof currentGhData === 'string' ? JSON.parse(currentGhData) : currentGhData;
    const tData = typeof targetGhData === 'string' ? JSON.parse(targetGhData) : targetGhData;

    if (!cData || !tData || Object.keys(cData).length === 0 || Object.keys(tData).length === 0) {
      return { raw: 0, activitySimilarity: 'none' };
    }

    // Language overlap
    const cLangs: string[] = Object.keys(cData.languages || cData.topLanguages || {}).map(l => l.toLowerCase());
    const tLangs: string[] = Object.keys(tData.languages || tData.topLanguages || {}).map(l => l.toLowerCase());
    const langJaccard = cLangs.length > 0 && tLangs.length > 0 ? jaccardSimilarity(cLangs, tLangs) : 0;

    // Contribution similarity (normalised)
    const cContrib = cData.totalContributions || cData.contributions || 0;
    const tContrib = tData.totalContributions || tData.contributions || 0;
    const maxContrib = Math.max(cContrib, tContrib, 1);
    const contribSimilarity = 1 - Math.abs(cContrib - tContrib) / maxContrib;

    const raw = langJaccard * 0.6 + contribSimilarity * 0.4;

    const activitySimilarity: 'high' | 'medium' | 'low' | 'none' =
      raw >= 0.7 ? 'high' : raw >= 0.4 ? 'medium' : raw > 0 ? 'low' : 'none';

    return { raw, activitySimilarity };
  } catch {
    return { raw: 0, activitySimilarity: 'none' };
  }
}

function scoreHackathon(currentActivity: any[], targetActivity: any[]): {
  raw: number;
  bothHackathoners: boolean;
} {
  const isHackathoner = (activity: any[]) => {
    if (!Array.isArray(activity)) return false;
    return activity.some((a: any) =>
      (a.type || '').toLowerCase().includes('hackathon') ||
      (a.label || '').toLowerCase().includes('hackathon')
    );
  };

  const cHack = isHackathoner(currentActivity);
  const tHack = isHackathoner(targetActivity);

  return {
    raw: cHack && tHack ? 1 : cHack !== tHack ? 0.3 : 0,
    bothHackathoners: cHack && tHack,
  };
}

function scoreLocation(currentLocation: string | null, targetLocation: string | null): number {
  if (!currentLocation || !targetLocation) return 0;
  const c = currentLocation.toLowerCase().trim();
  const t = targetLocation.toLowerCase().trim();
  if (c === t) return 1;
  // Partial city/country match
  const cParts = c.split(/[,\s]+/);
  const tParts = t.split(/[,\s]+/);
  const shared = cParts.filter(p => p.length > 2 && tParts.includes(p));
  return shared.length > 0 ? 0.5 : 0;
}

// ─── Main Exported Function ───────────────────────────────────────────────────

export function calculateCompatibility(
  currentUser: any,
  targetUser: any,
): CompatibilityResult {
  // --- Skills (30%) ---
  const { raw: rawSkills, sharedSkills } = scoreSkills(
    currentUser.skills || [],
    targetUser.skills || [],
  );
  const skillsScore = rawSkills * 30;

  // --- Projects (20%) ---
  const currentProjects = Array.isArray(currentUser.projects) ? currentUser.projects : [];
  const targetProjects  = Array.isArray(targetUser.projects) ? targetUser.projects : [];
  const { raw: rawProjects, sharedTech } = scoreProjects(currentProjects, targetProjects);
  const projectsScore = rawProjects * 20;

  // --- Intent (20%) ---
  const rawIntent = scoreIntent(currentUser.intent, targetUser.intent);
  const intentScore = rawIntent * 20;

  // --- GitHub (15%) ---
  const { raw: rawGh, activitySimilarity } = scoreGitHub(
    currentUser.githubData,
    targetUser.githubData,
  );
  const githubScore = rawGh * 15;

  // --- Hackathon (10%) ---
  const currentActivity = Array.isArray(currentUser.activity) ? currentUser.activity : [];
  const targetActivity  = Array.isArray(targetUser.activity) ? targetUser.activity : [];
  const { raw: rawHack, bothHackathoners } = scoreHackathon(currentActivity, targetActivity);
  const hackathonScore = rawHack * 10;

  // --- Location (5%) ---
  const rawLoc = scoreLocation(currentUser.location, targetUser.location);
  const locationScore = rawLoc * 5;

  // --- Final Score ---
  const rawTotal = skillsScore + projectsScore + intentScore + githubScore + hackathonScore + locationScore;
  const score = Math.min(100, Math.round(rawTotal));

  // --- Build Match Reasons (most impactful first) ---
  const reasons: MatchReason[] = [];

  if (sharedSkills.length > 0) {
    const display = sharedSkills.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ');
    reasons.push({
      icon: '⚡',
      label: `Both use ${display}`,
      category: 'skills',
    });
  }

  if (rawIntent === 1 && currentUser.intent) {
    const intent = currentUser.intent;
    reasons.push({
      icon: '🎯',
      label: `Same goal: ${intent}`,
      category: 'intent',
    });
  }

  if (sharedTech.length > 0) {
    const display = sharedTech.slice(0, 2).map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
    reasons.push({
      icon: '🚀',
      label: `Build with ${display}`,
      category: 'projects',
    });
  }

  if (activitySimilarity === 'high' || activitySimilarity === 'medium') {
    reasons.push({
      icon: '🐙',
      label: activitySimilarity === 'high' ? 'Very similar GitHub activity' : 'Similar GitHub patterns',
      category: 'github',
    });
  }

  if (bothHackathoners) {
    reasons.push({
      icon: '🏆',
      label: 'Both hackathon participants',
      category: 'hackathon',
    });
  }

  if (rawLoc >= 0.5) {
    reasons.push({
      icon: '📍',
      label: `Same location`,
      category: 'location',
    });
  }

  return {
    score,
    breakdown: {
      skills:    Math.round(skillsScore),
      projects:  Math.round(projectsScore),
      intent:    Math.round(intentScore),
      github:    Math.round(githubScore),
      hackathon: Math.round(hackathonScore),
      location:  Math.round(locationScore),
    },
    matchReasons: reasons.slice(0, 4), // Cap at 4 for UI
    algorithmVersion: 'v1-rule-based',
  };
}
