import { Router } from 'express';
import {
  generateContent,
  saveDocument,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/documentGeneratorController';
import { authenticate } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';

const router = Router();

// Generate AI content for a property (rate limited)
router.post('/content', authenticate, aiLimiter, generateContent);

// Save a generated document record
router.post('/save', authenticate, saveDocument);

// List generated documents
router.get('/documents', authenticate, listDocuments);

// Get single generated document
router.get('/documents/:id', authenticate, getDocument);

// Delete a generated document
router.delete('/documents/:id', authenticate, deleteDocument);

export default router;
