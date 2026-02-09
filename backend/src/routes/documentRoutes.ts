import { Router } from 'express';
import {
  uploadDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  extractDocument,
  getUploadUrl,
  createDocument,
  uploadFromUrl,
} from '../controllers/documentController';
import { optionalAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { validate, uuidParamSchema, documentUploadSchema } from '../middleware/validate';
import { uploadLimiter, aiLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * Document Routes
 * All routes require authentication
 */

// Upload document (with file) - rate limited (legacy, may not work on some cloud platforms)
router.post(
  '/upload',
  optionalAuth,
  uploadLimiter,
  upload.single('file'),
  validate(documentUploadSchema, 'body'),
  uploadDocument
);

// Get signed URL for direct upload to Supabase Storage (recommended)
router.post(
  '/upload-url',
  optionalAuth,
  uploadLimiter,
  getUploadUrl
);

// Create document record after direct upload
router.post(
  '/create',
  optionalAuth,
  createDocument
);

// Upload document from URL (Dropbox, Google Drive, etc.)
router.post(
  '/upload-from-url',
  optionalAuth,
  uploadLimiter,
  uploadFromUrl
);

// List documents
router.get('/', optionalAuth, listDocuments);

// Get single document
router.get(
  '/:id',
  optionalAuth,
  validate(uuidParamSchema, 'params'),
  getDocument
);

// Extract property data from document - rate limited (AI operation)
router.post(
  '/:id/extract',
  optionalAuth,
  aiLimiter,
  validate(uuidParamSchema, 'params'),
  extractDocument
);

// Delete document
router.delete(
  '/:id',
  optionalAuth,
  validate(uuidParamSchema, 'params'),
  deleteDocument
);

export default router;
