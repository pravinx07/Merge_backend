import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getAllBounties, createBounty, applyForBounty, submitBounty, acceptSubmission } from '../controllers/bounty.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAllBounties);
router.post('/', createBounty);
router.post('/:id/apply', applyForBounty); // We can keep it or remove it, keeping it for now
router.put('/:id/submit', submitBounty);
router.put('/:id/submissions/:submissionId/accept', acceptSubmission);

export default router;
