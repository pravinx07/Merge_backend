import { Request, Response } from 'express';
import prisma from '../Config/prisma';

export const likeUser = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const senderId = req.userId;
    const { receiverId } = req.body;

    if (senderId === receiverId) {
      return res.status(400).json({ message: "You can't like yourself" });
    }

    // Create the like
    const like = await prisma.like.create({
      data: {
        senderId,
        receiverId
      }
    });

    // Check if the other person has already liked the current user
    const reverseLike = await prisma.like.findUnique({
      where: {
        senderId_receiverId: {
          senderId: receiverId,
          receiverId: senderId
        }
      }
    });

    let isMatch = false;
    let match = null;

    if (reverseLike) {
      isMatch = true;
      // Create a match
      // Note: We always store user1Id < user2Id to maintain uniqueness
      const [u1, u2] = [senderId, receiverId].sort();
      
      // Create a Chat first
      const chat = await prisma.chat.create({
        data: {
          participants: {
            connect: [{ id: senderId }, { id: receiverId }]
          }
        }
      });

      match = await prisma.match.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: u1,
            user2Id: u2
          }
        },
        create: {
          user1Id: u1,
          user2Id: u2,
          chatId: chat.id
        },
        update: {
          chatId: chat.id
        },
        include: {
          user1: { select: { id: true, name: true, avatar: true, bio: true } },
          user2: { select: { id: true, name: true, avatar: true, bio: true } },
          chat: true
        }
      });
    }

    if (isMatch && match) {
      const io = req.app.get('io');
      if (io) {
        const u1Safe = { id: match.user1.id, name: match.user1.name, avatar: match.user1.avatar, status: null };
        const u2Safe = { id: match.user2.id, name: match.user2.name, avatar: match.user2.avatar, status: null };
        io.to(senderId).emit('match_created', {
          id: match.id,
          chatId: match.chatId,
          matchedAt: match.createdAt,
          user: match.user1Id === senderId ? u2Safe : u1Safe
        });
        io.to(receiverId).emit('match_created', {
          id: match.id,
          chatId: match.chatId,
          matchedAt: match.createdAt,
          user: match.user1Id === senderId ? u1Safe : u2Safe
        });
      }
    }

    res.status(200).json({
      message: isMatch ? "It's a match!" : "Liked successfully",
      isMatch,
      match
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
       return res.status(400).json({ message: 'Already liked this user' });
    }
    console.error('Like user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMatches = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: {
        user1: { select: { id: true, name: true, avatar: true, status: true } },
        user2: { select: { id: true, name: true, avatar: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format matches to return the "other" user
    const formattedMatches = matches.map(match => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1;
      return {
        id: match.id,
        chatId: match.chatId,
        matchedAt: match.createdAt,
        user: otherUser
      };
    });

    res.status(200).json(formattedMatches);
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const senderId = req.userId;
    const { chatId, content } = req.body;

    const message = await prisma.message.create({
      data: {
        content,
        chatId,
        senderId
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
