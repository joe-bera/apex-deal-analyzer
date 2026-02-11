import { Router } from 'express';
import { getLeaseTerms, upsertLeaseTerms, deleteLeaseTerms } from '../controllers/leaseTermsController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/:tenantId/lease-terms', getLeaseTerms);
router.put('/:tenantId/lease-terms', upsertLeaseTerms);
router.delete('/:tenantId/lease-terms', deleteLeaseTerms);

export default router;
