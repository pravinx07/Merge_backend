import { Router } from 'express';
import {
  getHackathons,
  getHackathonDetails,
  createHackathon,
  deleteHackathon,
  createTeam,
  applyToTeam,
  handleJoinRequest,
  getTeamMessages,
  sendTeamMessage
} from '../controllers/hackathon.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Browse hackathons
router.get('/', authenticate, getHackathons);
router.post('/', authenticate, createHackathon);

// Hackathon details (with recommended teams)
router.get('/:id', authenticate, getHackathonDetails);
router.delete('/:id', authenticate, deleteHackathon);

// Create hackathon team
router.post('/:id/teams', authenticate, createTeam);

// Apply to join a team
router.post('/teams/:teamId/apply', authenticate, applyToTeam);

// Handle join request (accept/reject)
router.put('/teams/:teamId/applications/:requestId', authenticate, handleJoinRequest);

// Team Chat
router.get('/teams/:teamId/chat', authenticate, getTeamMessages);
router.post('/teams/:teamId/chat', authenticate, sendTeamMessage);

export default router;
