import { Router } from 'express';
import { listBudgets, getBudget, createBudget, updateBudget, deleteBudget } from '../controllers/budgetController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listBudgets);
router.get('/:id', getBudget);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

export default router;
