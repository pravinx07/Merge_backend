import { Router } from 'express';
import { likeUser, getMatches, getMessages, sendMessage } from '../controllers/match.controller';
import { getSmartMatches } from '../controllers/smartMatch.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/smart', authenticate, getSmartMatches);
router.post('/like', authenticate, likeUser);
router.get('/', authenticate, getMatches);
router.get('/:chatId/messages', authenticate, getMessages);
router.post('/messages', authenticate, sendMessage);

export default router;
