import { Router } from 'express';
import { updateProfile } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.put('/profile', protect, updateProfile);

export default router;
