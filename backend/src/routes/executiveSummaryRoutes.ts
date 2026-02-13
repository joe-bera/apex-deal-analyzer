import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getUploadUrl,
  createSummary,
  listSummaries,
  deleteSummary,
} from '../controllers/executiveSummaryController';

const router = Router();

router.post('/upload-url', authenticate, getUploadUrl);
router.post('/', authenticate, createSummary);
router.get('/:propertyId', authenticate, listSummaries);
router.delete('/:id', authenticate, deleteSummary);

export default router;
