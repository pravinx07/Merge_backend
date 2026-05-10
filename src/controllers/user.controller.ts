import { Request, Response } from 'express';
import prisma from '../Config/prisma';

import bcrypt from 'bcryptjs';

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
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
