import { Router } from 'express';
import { getProfileInsights } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/insights/:userId', authenticate, getProfileInsights);

export default router;
