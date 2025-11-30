import { Router } from 'express';
import {
  createPropertyFromDocument,
  getProperty,
  listProperties,
  updateProperty,
  deleteProperty,
} from '../controllers/propertyController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Property Routes
 * All routes require authentication
 */

// Create property from extracted document data
router.post('/from-document/:documentId', authenticate, createPropertyFromDocument);

// List properties
router.get('/', authenticate, listProperties);

// Get single property with documents
router.get('/:id', authenticate, getProperty);

// Update property
router.patch('/:id', authenticate, updateProperty);

// Delete property (soft delete)
router.delete('/:id', authenticate, deleteProperty);

export default router;
