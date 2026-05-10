import { Router } from 'express';
import { likeUser, getMatches } from '../controllers/match.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/like', protect, likeUser);
router.get('/', protect, getMatches);

export default router;
