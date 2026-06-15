import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getAssessments, submitAssessment } from '../controllers/assessment.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAssessments);
router.post('/:id/submit', submitAssessment);

export default router;
