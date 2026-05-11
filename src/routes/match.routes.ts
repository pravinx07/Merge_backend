import { Router } from 'express';
import { likeUser, getMatches, getMessages, sendMessage } from '../controllers/match.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/like', protect, likeUser);
router.get('/', protect, getMatches);
router.get('/:chatId/messages', protect, getMessages);
router.post('/messages', protect, sendMessage);

export default router;
