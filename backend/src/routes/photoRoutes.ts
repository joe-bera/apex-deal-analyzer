import { Router } from 'express';
import {
  updatePhoto,
  deletePhoto,
  setPrimaryPhoto,
} from '../controllers/photoController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Photo Routes
 * All routes require authentication
 */

// Property-specific photo routes (nested under /properties/:propertyId)
// These are mounted in propertyRoutes.ts

// Standalone photo routes for update/delete operations
// PATCH /api/photos/:id - Update photo metadata
router.patch(
  '/:id',
  authenticate,
  updatePhoto
);

// DELETE /api/photos/:id - Delete a photo
router.delete(
  '/:id',
  authenticate,
  deletePhoto
);

// POST /api/photos/:id/set-primary - Set as primary photo
router.post(
  '/:id/set-primary',
  authenticate,
  setPrimaryPhoto
);

export default router;
