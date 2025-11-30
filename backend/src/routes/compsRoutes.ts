import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getCompsForProperty,
  addCompToProperty,
  updateComp,
  deleteComp,
} from '../controllers/compsController';

const router = Router();

/**
 * Comps Routes
 * All routes require authentication
 */

// Get all comps for a property
router.get('/properties/:propertyId/comps', authenticate, getCompsForProperty);

// Add a comp to a property
router.post('/properties/:propertyId/comps', authenticate, addCompToProperty);

// Update a comp
router.patch('/comps/:compId', authenticate, updateComp);

// Delete a comp
router.delete('/comps/:compId', authenticate, deleteComp);

export default router;
