import { Router } from 'express';
import { listExpenses, createExpense, updateExpense, deleteExpense, bulkCreateExpenses, categorizeExpenses } from '../controllers/expenseController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listExpenses);
router.post('/', createExpense);
router.post('/bulk', bulkCreateExpenses);
router.post('/categorize', categorizeExpenses);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
