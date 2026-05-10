import { Router } from 'express';
import { updateProfile, getProfile, changePassword, deleteAccount } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.post('/change-password', protect, changePassword);
router.delete('/', protect, deleteAccount);
router.get('/:id', getProfile);

export default router;
