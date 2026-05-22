import prisma from '../Config/prisma';

export class NotificationService {
  static async createNotification(
    io: any,
    data: {
      recipientId: string;
      senderId?: string;
      type: string;
      message: string;
      entityId?: string;
    }
  ) {
    try {
      if (data.senderId && data.senderId === data.recipientId) return null;

      const notification = await prisma.notification.create({
        data,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      if (io) {
        io.to(data.recipientId).emit('new_notification', notification);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }
}
