import { Router } from 'express';
import {
  generateContent,
  saveDocument,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/documentGeneratorController';
import { optionalAuth } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';

const router = Router();

// Generate AI content for a property (rate limited)
router.post('/content', optionalAuth, aiLimiter, generateContent);

// Save a generated document record
router.post('/save', optionalAuth, saveDocument);

// List generated documents
router.get('/documents', optionalAuth, listDocuments);

// Get single generated document
router.get('/documents/:id', optionalAuth, getDocument);

// Delete a generated document
router.delete('/documents/:id', optionalAuth, deleteDocument);

export default router;
