import { Router } from 'express';
import { getSwipeFeed, getRecommended, swipeRight, swipeLeft } from '../controllers/swipe.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/feed',        authenticate, getSwipeFeed);
router.get('/recommended', authenticate, getRecommended);
router.post('/right',      authenticate, swipeRight);
router.post('/left',       authenticate, swipeLeft);

export default router;
