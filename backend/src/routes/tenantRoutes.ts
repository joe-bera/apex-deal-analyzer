import { Router } from 'express';
import {
  listTenantsByProperty, getTenant, createTenant, updateTenant, deleteTenant, getRentRoll,
} from '../controllers/tenantController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/property/:propertyId', listTenantsByProperty);
router.get('/property/:propertyId/rent-roll', getRentRoll);
router.get('/:id', getTenant);
router.post('/', createTenant);
router.put('/:id', updateTenant);
router.delete('/:id', deleteTenant);

export default router;
