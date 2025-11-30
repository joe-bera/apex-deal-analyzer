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

const router = Router();

/**
 * Document Routes
 * All routes require authentication
 */

// Upload document (with file)
router.post('/upload', authenticate, upload.single('file'), uploadDocument);

// List documents
router.get('/', authenticate, listDocuments);

// Get single document
router.get('/:id', authenticate, getDocument);

// Extract property data from document
router.post('/:id/extract', authenticate, extractDocument);

// Delete document
router.delete('/:id', authenticate, deleteDocument);

export default router;
