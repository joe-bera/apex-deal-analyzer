import { Router } from 'express';
import {
  listRentPayments, createRentPayment, updateRentPayment, bulkCreateRentPayments,
} from '../controllers/rentPaymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listRentPayments);
router.post('/', createRentPayment);
router.post('/bulk', bulkCreateRentPayments);
router.put('/:id', updateRentPayment);

export default router;
