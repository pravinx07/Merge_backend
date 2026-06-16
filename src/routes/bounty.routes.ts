import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getAllBounties, createBounty, applyForBounty, submitBounty, completeBounty } from '../controllers/bounty.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAllBounties);
router.post('/', createBounty);
router.post('/:id/apply', applyForBounty);
router.put('/:id/submit', submitBounty);
router.put('/:id/complete', completeBounty);

export default router;
