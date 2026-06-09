import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import http from 'http';
import { initSocket } from './socket';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import matchRoutes from './routes/match.routes';
import swipeRoutes from './routes/swipe.routes';
import projectRoutes from './routes/project.routes';
import postRoutes from './routes/post.routes';
import githubRoutes from './routes/github.routes';
import hackathonRoutes from './routes/hackathon.routes';
import notificationRoutes from './routes/notification.routes';
import workspaceRoutes from './routes/workspace.routes';
import boostRoutes from './routes/boost.routes';
import profileRoutes from './routes/profile.routes';
import logger from './Config/logger';
import { httpLoggerMiddleware, errorHandlerMiddleware } from './middlewares/logger.middleware';
import prisma from './Config/prisma';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
const io = initSocket(server);
app.set('io', io);

// Middleware
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
app.use(cors({
  origin: [
    frontendUrl,
    'https://merge-frontend-six.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Request logging middleware (logs all incoming HTTP requests automatically)
app.use(httpLoggerMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/swipe', swipeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/hackathons', hackathonRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/boost', boostRoutes);
app.use('/api/profile', profileRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Merge Backend is running' });
});

// Advanced Global Error Handling Middleware (logs failures cleanly to file and console)
app.use(errorHandlerMiddleware);

// -------------------------------------------------------------
// 4. Graceful Shutdown & Process Crash Handling
// -------------------------------------------------------------
const handleGracefulShutdown = async (errorName: string, error: any) => {
  logger.error(`CRITICAL: Server is crashing due to ${errorName}!`, {
    message: error?.message || error,
    stack: error?.stack,
  });

  logger.info('Initiating graceful shutdown procedures...');

  // Disconnect from the database cleanly
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from database successfully.');
  } catch (dbError: any) {
    logger.error('Error disconnecting database during shutdown:', dbError);
  }

  // Close the server (stop accepting new requests)
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(1);
  });

  // Force shutdown after 5 seconds if graceful termination hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 5000);
};

// Listen for uncaught exception (synchronous syntax/ref errors)
process.on('uncaughtException', (error) => {
  handleGracefulShutdown('Uncaught Exception', error);
});

// Listen for unhandled promise rejections (async errors)
process.on('unhandledRejection', (reason) => {
  handleGracefulShutdown('Unhandled Rejection', reason);
});

// Start the server
server.listen(PORT, () => {
  logger.info(`Server is successfully running on port ${PORT}`);
});
