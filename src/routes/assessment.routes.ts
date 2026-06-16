import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getAssessments, submitAssessment, generateAssessment } from '../controllers/assessment.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAssessments);
router.post('/generate', generateAssessment);
router.post('/submit', submitAssessment);

export default router;
