import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import {
  createPost,
  getFeed,
  likePost,
  addComment,
  getComments,
  getTrending,
  deletePost,
  updatePost,
  votePoll
} from '../controllers/post.controller';

const router = Router();

// Feed & Trending
router.get('/feed', authenticate, getFeed);
router.get('/trending', authenticate, getTrending);

// Upload Image
router.post('/upload', authenticate, upload.single('image'), (req: any, res: any) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    res.status(200).json({ url: (req.file as any).path });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Posts
router.post('/', authenticate, createPost);
router.post('/:id/like', authenticate, likePost);
router.put('/:id', authenticate, updatePost);
router.delete('/:id', authenticate, deletePost);
router.post('/:id/poll/:optionId', authenticate, votePoll);

// Comments
router.get('/:id/comments', authenticate, getComments);
router.post('/:id/comments', authenticate, addComment);

export default router;
