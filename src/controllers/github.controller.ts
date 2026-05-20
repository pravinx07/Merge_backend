import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../Config/prisma';
import logger from '../Config/logger';

export const connectGithub = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { username } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!username) {
      return res.status(400).json({ message: 'GitHub username is required' });
    }

    // Fetch user profile from GitHub
    const userRes = await axios.get(`https://api.github.com/users/${username}`);
    const githubUser = userRes.data;

    // Fetch user repos
    const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`);
    const repos = reposRes.data;

    // Calculate top languages
    const languageCounts: Record<string, number> = {};
    const topRepos = repos
      .filter((r: any) => !r.fork)
      .sort((a: any, b: any) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
      }));

    repos.forEach((r: any) => {
      if (r.language) {
        languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
      }
    });

    const topLanguages = Object.entries(languageCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Mock contribution graph/count (GitHub API doesn't provide this easily without GraphQL/scraping)
    const mockContributions = Math.floor(Math.random() * 500) + 100;

    const githubData = {
      username: githubUser.login,
      name: githubUser.name,
      avatar: githubUser.avatar_url,
      bio: githubUser.bio,
      followers: githubUser.followers,
      following: githubUser.following,
      publicRepos: githubUser.public_repos,
      contributionsLastYear: mockContributions,
      topRepos,
      topLanguages,
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        githubVerified: true,
        githubData: githubData as any,
        githubUrl: githubUser.html_url,
        githubId: githubUser.id.toString(),
      },
    });

    res.status(200).json({ message: 'GitHub connected successfully', user: updatedUser });
  } catch (error: any) {
    logger.error('Error connecting GitHub:', error);
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'GitHub user not found' });
    }
    res.status(500).json({ message: 'Failed to connect GitHub', error: error.message });
  }
};

export const getGithubProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        githubVerified: true,
        githubData: true,
      },
    });

    if (!user || !user.githubVerified) {
      return res.status(404).json({ message: 'GitHub not connected' });
    }

    res.status(200).json(user.githubData);
  } catch (error: any) {
    logger.error('Error fetching GitHub profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
