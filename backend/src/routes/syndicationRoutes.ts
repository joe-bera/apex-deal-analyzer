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
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Platforms
router.get('/platforms', optionalAuth, listPlatforms);

// Bulk publish (before /:id routes)
router.post('/bulk-publish', optionalAuth, bulkPublish);

// CRUD
router.get('/', optionalAuth, listSyndications);
router.post('/', optionalAuth, createSyndication);
router.get('/:id', optionalAuth, getSyndication);
router.delete('/:id', optionalAuth, deleteSyndication);

// Actions
router.post('/:id/publish', optionalAuth, publishSyndication);
router.post('/:id/sync', optionalAuth, syncSyndication);
router.post('/:id/delist', optionalAuth, delistSyndication);
router.post('/:id/export', optionalAuth, generateExport);

// Activity
router.get('/:id/activity', optionalAuth, getSyndicationActivity);

export default router;
