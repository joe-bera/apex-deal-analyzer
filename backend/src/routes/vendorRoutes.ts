import { Router } from 'express';
import { listVendors, getVendor, createVendor, updateVendor, deleteVendor } from '../controllers/vendorController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listVendors);
router.get('/:id', getVendor);
router.post('/', createVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

export default router;
