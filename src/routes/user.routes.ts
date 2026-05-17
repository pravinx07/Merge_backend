import { Router } from 'express';
import { updateProfile, getProfile, changePassword, deleteAccount, getDiscoverUsers } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.get('/discover', authenticate, getDiscoverUsers);
router.put('/profile', authenticate, upload.single('avatar'), updateProfile);
router.post('/change-password', authenticate, changePassword);
router.delete('/', authenticate, deleteAccount);
router.get('/:id', getProfile);

export default router;
