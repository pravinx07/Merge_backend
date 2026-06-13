import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { 
  getWorkspace, 
  updateWorkspaceGoal, 
  updateWorkspaceRoles, 
  createTask, 
  updateTaskStatus,
  createWorkspaceUpdate,
  saveWorkspaceCode
} from '../controllers/workspace.controller';

const router = Router();

router.use(authenticate);

router.get('/:chatId', getWorkspace);
router.put('/:chatId/goal', updateWorkspaceGoal);
router.put('/:chatId/roles', updateWorkspaceRoles);
router.put('/:chatId/code', saveWorkspaceCode);
router.post('/:chatId/tasks', createTask);
router.put('/tasks/:taskId/status', updateTaskStatus);
router.post('/:chatId/updates', createWorkspaceUpdate);

export default router;
