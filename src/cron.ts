import cron from 'node-cron';
import prisma from './Config/prisma';
import { sendEmail } from './services/email.service';
import logger from './Config/logger';

export const initCronJobs = () => {
  // Run every Sunday at 9:00 AM ('0 9 * * 0')
  // For testing, we can use '* * * * *' to run every minute
  cron.schedule('0 9 * * 0', async () => {
    logger.info('[CRON] Starting weekly digest job...');
    try {
      // 1. Get all active users
      const users = await prisma.user.findMany({
        where: { status: { not: 'Suspended' } },
        select: { id: true, email: true, name: true, profileViews: true }
      });

      // 2. For each user, calculate weekly stats
      // In a real app, we would query the ProfileVisit table for the last 7 days.
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      for (const user of users) {
        const weeklyVisits = await prisma.profileVisit.count({
          where: {
            profileOwnerId: user.id,
            visitedAt: { gte: sevenDaysAgo }
          }
        });

        const newMatches = await prisma.match.count({
          where: {
            OR: [{ user1Id: user.id }, { user2Id: user.id }],
            createdAt: { gte: sevenDaysAgo }
          }
        });

        // 3. Send email if there's activity
        if (weeklyVisits > 0 || newMatches > 0) {
          const subject = `Your Merge Weekly Digest 🚀`;
          const html = `
            <h2>Hey ${user.name},</h2>
            <p>Here's how your profile performed this week:</p>
            <ul>
              <li><strong>${weeklyVisits}</strong> new profile views</li>
              <li><strong>${newMatches}</strong> new connections made</li>
            </ul>
            <p>Keep building and connecting!</p>
            <p>- The Merge Team</p>
          `;

          await sendEmail(user.email, subject, html);
        }
      }

      logger.info('[CRON] Weekly digest job completed successfully.');
    } catch (error) {
      logger.error('[CRON] Error running weekly digest job', error);
    }
  });

  logger.info('[CRON] Cron jobs initialized successfully');
};
