import { Router } from 'express';
import { authenticate } from '../middleware/auth';
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
  authenticate,
  getDealAnalysis
);

// Create or update deal analysis for a property
router.put(
  '/properties/:propertyId/analysis',
  authenticate,
  validate(propertyIdParamSchema, 'params'),
  validate(dealAnalysisSchema, 'body'),
  saveDealAnalysis
);

// Delete deal analysis for a property
router.delete(
  '/properties/:propertyId/analysis',
  authenticate,
  validate(propertyIdParamSchema, 'params'),
  deleteDealAnalysis
);

export default router;
