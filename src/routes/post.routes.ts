import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createPost,
  getFeed,
  likePost,
  addComment,
  getComments,
  getTrending
} from '../controllers/post.controller';

const router = Router();

// Feed & Trending
router.get('/feed', authenticate, getFeed);
router.get('/trending', authenticate, getTrending);

// Posts
router.post('/', authenticate, createPost);
router.post('/:id/like', authenticate, likePost);

// Comments
router.get('/:id/comments', authenticate, getComments);
router.post('/:id/comments', authenticate, addComment);

export default router;
