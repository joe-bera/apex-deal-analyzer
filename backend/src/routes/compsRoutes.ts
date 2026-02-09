import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import {
  getCompsForProperty,
  addCompToProperty,
  updateComp,
  deleteComp,
} from '../controllers/compsController';
import { validate } from '../middleware/validate';
import {
  propertyIdParamSchema,
  compIdParamSchema,
  createCompSchema,
  updateCompSchema,
} from '../middleware/validate';

const router = Router();

/**
 * Comps Routes
 * All routes require authentication
 */

// Get all comps for a property
router.get(
  '/properties/:propertyId/comps',
  optionalAuth,
  validate(propertyIdParamSchema, 'params'),
  getCompsForProperty
);

// Add a comp to a property
router.post(
  '/properties/:propertyId/comps',
  optionalAuth,
  validate(propertyIdParamSchema, 'params'),
  validate(createCompSchema, 'body'),
  addCompToProperty
);

// Update a comp
router.patch(
  '/comps/:compId',
  optionalAuth,
  validate(compIdParamSchema, 'params'),
  validate(updateCompSchema, 'body'),
  updateComp
);

// Delete a comp
router.delete(
  '/comps/:compId',
  optionalAuth,
  validate(compIdParamSchema, 'params'),
  deleteComp
);

export default router;
