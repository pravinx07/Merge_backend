import { Router } from 'express';
import { getSwipeFeed, swipeRight, swipeLeft } from '../controllers/swipe.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.get('/feed', protect, getSwipeFeed);
router.post('/right', protect, swipeRight);
router.post('/left', protect, swipeLeft);

export default router;
