import { Router } from 'express';
import { updateProfile, getProfile, changePassword, deleteAccount, getDiscoverUsers, getCommunityUsers, getPublicCommunityUsers, blockUser, reportUser, getBlockedUsers, unblockUser, uploadImage, getProfileVisitors, getVisitorStats } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.get('/discover', authenticate, getDiscoverUsers);
router.get('/community', authenticate, getCommunityUsers);
router.get('/public-community', getPublicCommunityUsers);
router.get('/visitors', authenticate, getProfileVisitors);
router.get('/visitors/stats', authenticate, getVisitorStats);
router.post('/upload-image', authenticate, upload.single('image'), uploadImage);
router.put('/profile', authenticate, upload.single('avatar'), updateProfile);
router.post('/change-password', authenticate, changePassword);
router.delete('/', authenticate, deleteAccount);
router.post('/block', authenticate, blockUser);
router.post('/unblock', authenticate, unblockUser);
router.get('/blocked', authenticate, getBlockedUsers);
router.post('/report', authenticate, reportUser);
router.get('/:id', getProfile);

export default router;
