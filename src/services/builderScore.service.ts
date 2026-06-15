import prisma from '../Config/prisma';

export const calculateBuilderScore = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedProjects: true,
        projectMemberships: true,
        hackathonTeamMemberships: true,
        posts: true,
        comments: true,
      }
    });

    if (!user) return null;

    let score = 0;
    const badges: Set<string> = new Set(user.badges);

    // 1. GitHub Activity
    if (user.githubVerified && user.githubData) {
      const githubData = user.githubData as any;
      if (githubData.publicRepos) {
        score += githubData.publicRepos * 5; // +5 per repo
      }
      if (githubData.contributionsLastYear) {
        score += Math.floor(githubData.contributionsLastYear / 10); // +1 per 10 contributions
        if (githubData.contributionsLastYear > 500) {
          badges.add('Open Source Warrior');
        }
      }
    }

    // 2. Projects
    const totalProjects = user.ownedProjects.length + user.projectMemberships.length;
    score += totalProjects * 20; // +20 per project
    
    if (user.ownedProjects.length > 0) {
      badges.add('Startup Founder');
    }
    if (totalProjects >= 3) {
      badges.add('MVP Launcher');
    }

    // 3. Hackathons
    const totalHackathons = user.hackathonTeamMemberships.length;
    score += totalHackathons * 30; // +30 per hackathon
    
    if (totalHackathons >= 1) {
      badges.add('Hackathon Champion');
    }

    // 4. Community
    score += user.posts.length * 5;
    score += user.comments.length * 2;
    
    if (user.posts.length + user.comments.length > 50) {
      badges.add('Great Collaborator');
    }
    
    // 5. Assessments (Verified Skills)
    if (user.verifiedSkills && user.verifiedSkills.length > 0) {
      score += user.verifiedSkills.length * 50; // +50 per verified skill
      if (user.verifiedSkills.length >= 3) {
        badges.add('Certified Expert');
      }
    }
    
    // Determine Level
    let level = 'Beginner Builder';
    if (score >= 1000) level = 'Legendary Builder';
    else if (score >= 700) level = 'Elite Builder';
    else if (score >= 300) level = 'Active Builder';
    else if (score >= 100) level = 'Growing Builder';
    
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        builderScore: score,
        builderLevel: level,
        badges: Array.from(badges)
      }
    });

    return updatedUser;
  } catch (error) {
    console.error('Error calculating builder score:', error);
    return null;
  }
};
