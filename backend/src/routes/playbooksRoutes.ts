import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import {
  listPlaybooks,
  getPlaybook,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  addPlaybookTask,
  updatePlaybookTask,
  deletePlaybookTask,
  listDealTasks,
  createDealTask,
  updateDealTask,
  deleteDealTask,
  applyPlaybook,
} from '../controllers/playbooksController';

const router = Router();

// Playbook template CRUD
router.get('/', optionalAuth, listPlaybooks);
router.get('/:id', optionalAuth, getPlaybook);
router.post('/', optionalAuth, createPlaybook);
router.patch('/:id', optionalAuth, updatePlaybook);
router.delete('/:id', optionalAuth, deletePlaybook);

// Playbook task templates
router.post('/:id/tasks', optionalAuth, addPlaybookTask);
router.patch('/:playbookId/tasks/:taskId', optionalAuth, updatePlaybookTask);
router.delete('/:playbookId/tasks/:taskId', optionalAuth, deletePlaybookTask);

export default router;

// Deal tasks router (mounted under /api/crm-deals)
export const dealTasksRouter = Router();
dealTasksRouter.get('/:dealId/tasks', optionalAuth, listDealTasks);
dealTasksRouter.post('/:dealId/tasks', optionalAuth, createDealTask);
dealTasksRouter.patch('/:dealId/tasks/:taskId', optionalAuth, updateDealTask);
dealTasksRouter.delete('/:dealId/tasks/:taskId', optionalAuth, deleteDealTask);
dealTasksRouter.post('/:dealId/apply-playbook', optionalAuth, applyPlaybook);
