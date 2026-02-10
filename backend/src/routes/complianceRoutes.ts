import { Router } from 'express';
import { listComplianceItems, getComplianceItem, createComplianceItem, updateComplianceItem, deleteComplianceItem, getUpcomingCompliance } from '../controllers/complianceController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/upcoming', getUpcomingCompliance);
router.get('/', listComplianceItems);
router.get('/:id', getComplianceItem);
router.post('/', createComplianceItem);
router.put('/:id', updateComplianceItem);
router.delete('/:id', deleteComplianceItem);

export default router;
