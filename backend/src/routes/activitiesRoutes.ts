import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate, uuidParamSchema, createActivitySchema, updateActivitySchema } from '../middleware/validate';
import {
  listActivities,
  getUpcomingTasks,
  createActivity,
  updateActivity,
  completeActivity,
  deleteActivity,
} from '../controllers/activitiesController';

const router = Router();

router.get('/', authenticate, listActivities);
router.get('/upcoming-tasks', authenticate, getUpcomingTasks);
router.post('/', authenticate, validate(createActivitySchema, 'body'), createActivity);
router.patch('/:id', authenticate, validate(uuidParamSchema, 'params'), validate(updateActivitySchema, 'body'), updateActivity);
router.patch('/:id/complete', authenticate, validate(uuidParamSchema, 'params'), completeActivity);
router.delete('/:id', authenticate, validate(uuidParamSchema, 'params'), deleteActivity);

export default router;
