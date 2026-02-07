import { Router } from 'express';
import {
  listPlatforms,
  listSyndications,
  getSyndication,
  createSyndication,
  publishSyndication,
  syncSyndication,
  delistSyndication,
  deleteSyndication,
  generateExport,
  getSyndicationActivity,
  bulkPublish,
} from '../controllers/syndicationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Platforms
router.get('/platforms', authenticate, listPlatforms);

// Bulk publish (before /:id routes)
router.post('/bulk-publish', authenticate, bulkPublish);

// CRUD
router.get('/', authenticate, listSyndications);
router.post('/', authenticate, createSyndication);
router.get('/:id', authenticate, getSyndication);
router.delete('/:id', authenticate, deleteSyndication);

// Actions
router.post('/:id/publish', authenticate, publishSyndication);
router.post('/:id/sync', authenticate, syncSyndication);
router.post('/:id/delist', authenticate, delistSyndication);
router.post('/:id/export', authenticate, generateExport);

// Activity
router.get('/:id/activity', authenticate, getSyndicationActivity);

export default router;
