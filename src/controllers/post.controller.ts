import { Request, Response } from 'express';
import prisma from '../Config/prisma';
import { cacheService } from '../services/cacheService';

export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, postType } = req.body;
    const authorId = (req as any).userId;

    if (!authorId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!content) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        content,
        postType: postType || 'Update',
        authorId,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, bio: true }
        },
        _count: {
          select: { likes: true, comments: true }
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Error creating post' });
  }
};

export const getFeed = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, name: true, avatar: true, bio: true }
        },
        likes: {
          where: { userId },
          select: { userId: true }
        },
        _count: {
          select: { likes: true, comments: true }
        }
      }
    });

    const formattedPosts = posts.map(post => ({
      ...post,
      hasLiked: post.likes.length > 0,
      likes: undefined
    }));

    res.status(200).json(formattedPosts);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ message: 'Error fetching feed' });
  }
};

export const likePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: id,
          userId
        }
      }
    });

    if (existingLike) {
      await prisma.postLike.delete({
        where: { id: existingLike.id }
      });
      res.status(200).json({ message: 'Post unliked', hasLiked: false });
    } else {
      await prisma.postLike.create({
        data: {
          postId: id,
          userId
        }
      });
      res.status(200).json({ message: 'Post liked', hasLiked: true });
    }
  } catch (error) {
    console.error('Error liking/unliking post:', error);
    res.status(500).json({ message: 'Error updating like status' });
  }
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const authorId = (req as any).userId;

    if (!authorId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!content) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: id,
        authorId
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
};

export const getComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const comments = await prisma.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    res.status(200).json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments' });
  }
};

export const getTrending = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    // Fetch trending developers from cache or DB
    let trendingDevelopers = cacheService.get<any[]>('trending:developers');
    if (!trendingDevelopers) {
      trendingDevelopers = await prisma.user.findMany({
        take: 10, // Fetch slightly more to filter out current user dynamically
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          bio: true,
          skills: true
        }
      });
      cacheService.set('trending:developers', trendingDevelopers, 600); // 10 minutes cache
    }

    // Filter out the current user and limit to top 3 in-memory
    const filteredDevelopers = trendingDevelopers
      .filter(dev => dev.id !== userId)
      .slice(0, 3);

    // Fetch trending projects from cache or DB
    let trendingProjects = cacheService.get<any[]>('trending:projects');
    if (!trendingProjects) {
      trendingProjects = await prisma.project.findMany({
        take: 3,
        where: {
          status: { in: ['Building', 'MVP', 'Launched'] }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          title: true,
          description: true,
          techStack: true,
          owner: {
            select: { id: true, name: true, avatar: true }
          }
        }
      });
      cacheService.set('trending:projects', trendingProjects, 600); // 10 minutes cache
    }

    res.status(200).json({
      trendingDevelopers: filteredDevelopers,
      trendingProjects
    });
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({ message: 'Error fetching trending' });
  }
};
