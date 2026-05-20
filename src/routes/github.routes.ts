import { Router } from 'express';
import { connectGithub, getGithubProfile } from '../controllers/github.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Connect GitHub (simulated OAuth using username)
router.post('/connect', authenticate as any, connectGithub as any);

// Get GitHub Profile data for a specific user
router.get('/profile/:userId', authenticate as any, getGithubProfile as any);

export default router;
