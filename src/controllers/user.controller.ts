import { Request, Response } from 'express';
import prisma from '../Config/prisma';

export const updateProfile = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    const { bio, avatar, skills, role } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        bio,
        avatar,
        skills,
        role,
      },
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, bio: user.bio, skills: user.skills, role: user.role }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
