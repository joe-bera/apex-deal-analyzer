import { Router } from 'express';
import {
  runAIResearch,
  getResearch,
  createManualResearch,
  updateResearch,
  deleteResearch,
} from '../controllers/ownerResearchController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(optionalAuth);

// AI-powered research
router.post('/:propertyId/ai', runAIResearch);

// Get all research for a property
router.get('/:propertyId', getResearch);

// Create manual research entry
router.post('/:propertyId', createManualResearch);

// Update a research entry
router.patch('/:id', updateResearch);

// Delete a research entry
router.delete('/:id', deleteResearch);

export default router;
