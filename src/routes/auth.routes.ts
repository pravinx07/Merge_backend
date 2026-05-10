import { Router } from 'express';
import { register, login, me, logout, githubCallback, githubLogin } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.post('/logout', logout);
router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);

export default router;
