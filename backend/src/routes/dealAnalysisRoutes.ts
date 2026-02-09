import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import {
  getDealAnalysis,
  saveDealAnalysis,
  deleteDealAnalysis,
} from '../controllers/dealAnalysisController';
import { validate } from '../middleware/validate';
import { propertyIdParamSchema, dealAnalysisSchema } from '../middleware/validate';

const router = Router();

/**
 * Deal Analysis Routes
 * All routes require authentication
 */

// Get deal analysis for a property
router.get(
  '/properties/:propertyId/analysis',
  optionalAuth,
  validate(propertyIdParamSchema, 'params'),
  getDealAnalysis
);

// Create or update deal analysis for a property
router.put(
  '/properties/:propertyId/analysis',
  optionalAuth,
  validate(propertyIdParamSchema, 'params'),
  validate(dealAnalysisSchema, 'body'),
  saveDealAnalysis
);

// Delete deal analysis for a property
router.delete(
  '/properties/:propertyId/analysis',
  optionalAuth,
  validate(propertyIdParamSchema, 'params'),
  deleteDealAnalysis
);

export default router;
