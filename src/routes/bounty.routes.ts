import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createBountySchema, submitBountySchema } from '../validators/bounty.validator';
import { getAllBounties, createBounty, applyForBounty, submitBounty, completeBounty } from '../controllers/bounty.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAllBounties);
router.post('/', validate(createBountySchema), createBounty);
router.post('/:id/apply', applyForBounty);
router.put('/:id/submit', validate(submitBountySchema), submitBounty);
router.put('/:id/complete', completeBounty);

export default router;
