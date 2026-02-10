import { Router } from 'express';
import { listInspections, getInspection, createInspection, updateInspection, deleteInspection, createConditionItem, updateConditionItem } from '../controllers/inspectionController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listInspections);
router.get('/:id', getInspection);
router.post('/', createInspection);
router.put('/:id', updateInspection);
router.delete('/:id', deleteInspection);
router.post('/:id/condition-items', createConditionItem);
router.put('/:id/condition-items/:itemId', updateConditionItem);

export default router;
