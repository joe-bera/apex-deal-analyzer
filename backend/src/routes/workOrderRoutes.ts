import { Router } from 'express';
import { listWorkOrders, getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder } from '../controllers/workOrderController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listWorkOrders);
router.get('/:id', getWorkOrder);
router.post('/', createWorkOrder);
router.put('/:id', updateWorkOrder);
router.delete('/:id', deleteWorkOrder);

export default router;
