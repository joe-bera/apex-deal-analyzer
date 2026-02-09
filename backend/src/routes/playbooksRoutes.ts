import { Router } from 'express';
import { authenticate } from '../middleware/auth';
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
router.get('/', authenticate, listPlaybooks);
router.get('/:id', authenticate, getPlaybook);
router.post('/', authenticate, createPlaybook);
router.patch('/:id', authenticate, updatePlaybook);
router.delete('/:id', authenticate, deletePlaybook);

// Playbook task templates
router.post('/:id/tasks', authenticate, addPlaybookTask);
router.patch('/:playbookId/tasks/:taskId', authenticate, updatePlaybookTask);
router.delete('/:playbookId/tasks/:taskId', authenticate, deletePlaybookTask);

export default router;

// Deal tasks router (mounted under /api/crm-deals)
export const dealTasksRouter = Router();
dealTasksRouter.get('/:dealId/tasks', authenticate, listDealTasks);
dealTasksRouter.post('/:dealId/tasks', authenticate, createDealTask);
dealTasksRouter.patch('/:dealId/tasks/:taskId', authenticate, updateDealTask);
dealTasksRouter.delete('/:dealId/tasks/:taskId', authenticate, deleteDealTask);
dealTasksRouter.post('/:dealId/apply-playbook', authenticate, applyPlaybook);
