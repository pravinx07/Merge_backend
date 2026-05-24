import { Request, Response } from 'express';
import prisma from '../Config/prisma';

import bcrypt from 'bcryptjs';
import { calculateBuilderScore } from '../services/builderScore.service';

export const updateProfile = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    console.log('--- UPDATE PROFILE START ---');
    console.log('User ID:', userId);
    console.log('Full req.body:', JSON.stringify(req.body, null, 2));
    console.log('req.file:', req.file);

    const { 
      name, bio, skills, experienceLevel, interests, 
      intent, location, website, twitter, linkedin, 
      githubUrl, projects, personality, status 
    } = req.body;

    const parseArray = (val: any) => {
      console.log(`Parsing array for value:`, val);
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [val];
        } catch {
          return val.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      return [val];
    };

    let avatarUrl = undefined;
    if (req.file) {
      avatarUrl = (req.file as any).path;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = parseArray(skills);
    if (experienceLevel !== undefined) updateData.experienceLevel = experienceLevel;
    if (interests !== undefined) updateData.interests = parseArray(interests);
    if (intent !== undefined) updateData.intent = intent;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (twitter !== undefined) updateData.twitter = twitter;
    if (linkedin !== undefined) updateData.linkedin = linkedin;
    if (githubUrl !== undefined) updateData.githubUrl = githubUrl;
    if (personality !== undefined) updateData.personality = personality;
    if (status !== undefined) updateData.status = status;
    
    if (projects) {
      updateData.projects = typeof projects === 'string' ? JSON.parse(projects) : projects;
    }

    if (avatarUrl) updateData.avatar = avatarUrl;

    console.log('Final UpdateData for Prisma:', JSON.stringify(updateData, null, 2));

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log('Prisma Update Result:', !!user);
    console.log('--- UPDATE PROFILE END ---');

    res.status(200).json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Refresh builder score
    const updatedUser = await calculateBuilderScore(id);
    if (updatedUser) {
      user = updatedUser;
    }

    // @ts-ignore
    delete user.password;
    res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return res.status(400).json({ message: 'User not found or using social login' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    await prisma.user.delete({ where: { id: userId } });
    res.clearCookie('token');
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getDiscoverUsers = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const currentUserId = req.userId;
    const { page = 1, skills, intent, experienceLevel, search } = req.query;
    const limit = 10;
    const skip = (Number(page) - 1) * limit;

    // 1. Get IDs of users current user has already liked
    const likedUserIds = await prisma.like.findMany({
      where: { senderId: currentUserId },
      select: { receiverId: true }
    }).then(likes => likes.map(l => l.receiverId));

    // 2. Get blocked/blocking users
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: currentUserId },
          { blockedId: currentUserId }
        ]
      }
    });
    const blockedUserIds = blocks.map(b => b.blockerId === currentUserId ? b.blockedId : b.blockerId);

    // 3. Build where clause
    const where: any = {
      id: {
        notIn: [currentUserId, ...likedUserIds, ...blockedUserIds]
      }
    };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { bio: { contains: String(search), mode: 'insensitive' } },
        { skills: { hasSome: [String(search)] } }
      ];
    }

    if (skills) {
      const skillsArray = String(skills).split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        where.skills = { hasSome: skillsArray };
      }
    }

    if (intent) {
      where.intent = String(intent);
    }

    if (experienceLevel) {
      where.experienceLevel = String(experienceLevel);
    }

    // 3. Fetch users
    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });

    // 4. Calculate compatibility scores
    const usersWithScore = users.map(user => {
      let score = 0;
      if (currentUser) {
        // Shared skills (40%)
        const sharedSkills = user.skills.filter(s => currentUser.skills.includes(s));
        const totalSkills = Array.from(new Set([...user.skills, ...currentUser.skills])).length;
        if (totalSkills > 0) {
           score += (sharedSkills.length / totalSkills) * 40;
        }

        // Shared interests (30%)
        const sharedInterests = user.interests.filter(i => currentUser.interests.includes(i));
        const totalInterests = Array.from(new Set([...user.interests, ...currentUser.interests])).length;
        if (totalInterests > 0) {
           score += (sharedInterests.length / totalInterests) * 30;
        }

        // Same intent (20%)
        if (user.intent && currentUser.intent && user.intent === currentUser.intent) {
          score += 20;
        }

        // Same location (10%)
        if (user.location && currentUser.location && user.location.toLowerCase() === currentUser.location.toLowerCase()) {
          score += 10;
        }
      }

      // @ts-ignore
      delete user.password;
      return {
        ...user,
        compatibilityScore: Math.round(score) || 0
      };
    });

    res.status(200).json(usersWithScore);
  } catch (error) {
    console.error('Discover users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCommunityUsers = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const currentUserId = req.userId;
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: currentUserId },
          { blockedId: currentUserId }
        ]
      }
    });
    const blockedUserIds = blocks.map(b => b.blockerId === currentUserId ? b.blockedId : b.blockerId);

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: [currentUserId, ...blockedUserIds] }
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        skills: true,
        location: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.status(200).json(users);
  } catch (error) {
    console.error('Get community users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const blockUser = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const blockerId = req.userId;
    const { userId } = req.body;

    if (!userId || blockerId === userId) {
      return res.status(400).json({ message: 'Invalid user to block' });
    }

    await prisma.block.create({
      data: {
        blockerId,
        blockedId: userId
      }
    });

    res.status(200).json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const reportUser = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const reporterId = req.userId;
    const { userId, reason, details } = req.body;

    if (!userId || reporterId === userId || !reason) {
      return res.status(400).json({ message: 'Invalid report data' });
    }

    await prisma.report.create({
      data: {
        reporterId,
        reportedId: userId,
        reason,
        details
      }
    });

    res.status(200).json({ message: 'User reported successfully' });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const blockerId = req.userId;
    const blocks = await prisma.block.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: { id: true, name: true, avatar: true, bio: true }
        }
      }
    });
    res.status(200).json(blocks.map(b => b.blocked));
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const unblockUser = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const blockerId = req.userId;
    const { userId } = req.body;
    await prisma.block.deleteMany({
      where: { blockerId, blockedId: userId }
    });
    res.status(200).json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
