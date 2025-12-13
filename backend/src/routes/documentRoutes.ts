import { Router } from 'express';
import {
  uploadDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  extractDocument,
} from '../controllers/documentController';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { validate, uuidParamSchema, documentUploadSchema } from '../middleware/validate';
import { uploadLimiter, aiLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * Document Routes
 * All routes require authentication
 */

// Upload document (with file) - rate limited
router.post(
  '/upload',
  authenticate,
  uploadLimiter,
  upload.single('file'),
  validate(documentUploadSchema, 'body'),
  uploadDocument
);

// List documents
router.get('/', authenticate, listDocuments);

// Get single document
router.get(
  '/:id',
  authenticate,
  validate(uuidParamSchema, 'params'),
  getDocument
);

// Extract property data from document - rate limited (AI operation)
router.post(
  '/:id/extract',
  authenticate,
  aiLimiter,
  validate(uuidParamSchema, 'params'),
  extractDocument
);

// Delete document
router.delete(
  '/:id',
  authenticate,
  validate(uuidParamSchema, 'params'),
  deleteDocument
);

export default router;
