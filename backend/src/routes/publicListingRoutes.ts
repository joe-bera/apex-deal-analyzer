import { Router } from 'express';
import { getPublicListing, submitLead } from '../controllers/publicListingController';
import { strictLimiter } from '../middleware/rateLimit';

const router = Router();

// Public endpoints — NO authenticate middleware
router.get('/listings/:slug', getPublicListing);
router.post('/listings/:slug/leads', strictLimiter, submitLead);

export default router;
