import { Router } from 'express';
import {
  listCamReconciliations, getCamReconciliation, createCamReconciliation,
  calculateCamReconciliation, updateCamReconciliation, finalizeCamReconciliation,
  getCamExpenseBreakdown, extractLeaseTerms, getCamReport,
} from '../controllers/camReconciliationController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listCamReconciliations);
router.get('/:id', getCamReconciliation);
router.post('/', createCamReconciliation);
router.post('/extract-lease-terms', extractLeaseTerms);
router.post('/:id/calculate', calculateCamReconciliation);
router.put('/:id', updateCamReconciliation);
router.post('/:id/finalize', finalizeCamReconciliation);
router.get('/:id/expense-breakdown', getCamExpenseBreakdown);
router.get('/:id/report', getCamReport);

export default router;
