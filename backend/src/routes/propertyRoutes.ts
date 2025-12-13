import { Router } from 'express';
import {
  createPropertyFromDocument,
  getProperty,
  listProperties,
  updateProperty,
  deleteProperty,
  analyzePropertyValuation,
} from '../controllers/propertyController';
import {
  generatePropertyLOI,
  getPropertyLOIs,
  updateLOI,
} from '../controllers/loiController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  uuidParamSchema,
  documentIdParamSchema,
  updatePropertySchema,
  propertyOverridesSchema,
  listPropertiesQuerySchema,
} from '../middleware/validate';
import { aiLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * Property Routes
 * All routes require authentication
 */

// Create property from extracted document data
router.post(
  '/from-document/:documentId',
  authenticate,
  validate(documentIdParamSchema, 'params'),
  validate(propertyOverridesSchema, 'body'),
  createPropertyFromDocument
);

// List properties with filters
router.get(
  '/',
  authenticate,
  validate(listPropertiesQuerySchema, 'query'),
  listProperties
);

// Get single property with documents
router.get(
  '/:id',
  authenticate,
  validate(uuidParamSchema, 'params'),
  getProperty
);

// Update property
router.patch(
  '/:id',
  authenticate,
  validate(uuidParamSchema, 'params'),
  validate(updatePropertySchema, 'body'),
  updateProperty
);

// Delete property (soft delete)
router.delete(
  '/:id',
  authenticate,
  validate(uuidParamSchema, 'params'),
  deleteProperty
);

// Analyze property valuation with AI (rate limited)
router.post(
  '/:id/analyze',
  authenticate,
  aiLimiter,
  validate(uuidParamSchema, 'params'),
  analyzePropertyValuation
);

// Generate LOI for property
router.post(
  '/:propertyId/loi',
  authenticate,
  generatePropertyLOI
);

// Get all LOIs for a property
router.get(
  '/:propertyId/lois',
  authenticate,
  getPropertyLOIs
);

// Update LOI (separate route for LOI by ID)
router.patch(
  '/lois/:loiId',
  authenticate,
  updateLOI
);

export default router;
