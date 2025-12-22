import { Router } from 'express';
import {
  getMasterProperties,
  getMasterProperty,
  importProperties,
  searchDuplicates,
  getVerificationQueue,
  verifyProperty,
} from '../controllers/masterPropertyController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List properties
router.get('/', getMasterProperties);

// Get verification queue
router.get('/verification-queue', getVerificationQueue);

// Search for duplicates
router.get('/duplicates', searchDuplicates);

// Get single property
router.get('/:id', getMasterProperty);

// Bulk import
router.post('/import', importProperties);

// Verify property
router.post('/:id/verify', verifyProperty);

export default router;
