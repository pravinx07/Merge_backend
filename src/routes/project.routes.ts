import { Router } from 'express';
import { 
  createProject, 
  getProjects, 
  getProjectDetails, 
  applyToProject, 
  handleApplication,
  getProjectMessages,
  sendProjectMessage
} from '../controllers/project.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Browse projects and create project
router.get('/', authenticate, getProjects);
router.post('/', authenticate, createProject);

// Single project details
router.get('/:id', authenticate, getProjectDetails);

// Apply to project
router.post('/:id/apply', authenticate, applyToProject);

// Handle application
router.put('/:id/applications/:appId', authenticate, handleApplication);

// Project Chat
router.get('/:id/chat', authenticate, getProjectMessages);
router.post('/:id/chat', authenticate, sendProjectMessage);

export default router;
