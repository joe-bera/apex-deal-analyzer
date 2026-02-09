import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
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

router.get('/', optionalAuth, listActivities);
router.get('/upcoming-tasks', optionalAuth, getUpcomingTasks);
router.post('/', optionalAuth, validate(createActivitySchema, 'body'), createActivity);
router.patch('/:id', optionalAuth, validate(uuidParamSchema, 'params'), validate(updateActivitySchema, 'body'), updateActivity);
router.patch('/:id/complete', optionalAuth, validate(uuidParamSchema, 'params'), completeActivity);
router.delete('/:id', optionalAuth, validate(uuidParamSchema, 'params'), deleteActivity);

export default router;
