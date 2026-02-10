import { Router } from 'express';
import { getOwnerStatement, getYearEndReport, getBudgetVsActual } from '../controllers/financialReportController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/owner-statement', getOwnerStatement);
router.get('/year-end', getYearEndReport);
router.get('/budget-vs-actual', getBudgetVsActual);

export default router;
