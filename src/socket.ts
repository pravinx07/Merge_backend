import { Server } from 'socket.io';
import http from 'http';
import prisma from './Config/prisma';

export const initSocket = (server: http.Server) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const io = new Server(server, {
    cors: {
      origin: [
        frontendUrl,
        'https://merge-frontend-six.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Online users map: userId -> socketId
  const onlineUsers = new Map<string, string>();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User joins with their ID
    socket.on('setup', (userData) => {
      if (!userData?.id) return;
      socket.join(userData.id);
      onlineUsers.set(userData.id, socket.id);
      socket.emit('connected');
      io.emit('online_status', Array.from(onlineUsers.keys()));
    });

    // Join a chat room
    socket.on('join_chat', (room) => {
      socket.join(room);
      console.log('User joined room:', room);
    });

    // Typing indicators
    socket.on('typing', (room) => socket.in(room).emit('typing', room));
    socket.on('stop_typing', (room) => socket.in(room).emit('stop_typing', room));

    // New message
    socket.on('new_message', async (newMessageReceived) => {
      const { chatId, senderId, content, participants } = newMessageReceived;

      if (!participants) return console.log('Participants not defined');

      // Save message to database
      try {
        const message = await prisma.message.create({
          data: {
            content,
            chatId,
            senderId
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
            chat: { include: { participants: true } }
          }
        });

        // Broadcast to participants
        participants.forEach((user: any) => {
          if (user.id === senderId) return;
          socket.in(user.id).emit('message_received', message);
        });
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Remove from online users
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
      io.emit('online_status', Array.from(onlineUsers.keys()));
    });
  });

  return io;
};
