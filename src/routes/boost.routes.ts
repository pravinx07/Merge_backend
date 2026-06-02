import { Router } from 'express';
import { activateBoost, getBoostStatus } from '../controllers/boost.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/activate', authenticate, activateBoost);
router.get('/status', authenticate, getBoostStatus);

export default router;
