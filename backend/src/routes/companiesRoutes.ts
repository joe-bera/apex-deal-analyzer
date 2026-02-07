import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate, uuidParamSchema, createCompanySchema, updateCompanySchema } from '../middleware/validate';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../controllers/companiesController';

const router = Router();

router.get('/', authenticate, listCompanies);
router.get('/:id', authenticate, validate(uuidParamSchema, 'params'), getCompany);
router.post('/', authenticate, validate(createCompanySchema, 'body'), createCompany);
router.patch('/:id', authenticate, validate(uuidParamSchema, 'params'), validate(updateCompanySchema, 'body'), updateCompany);
router.delete('/:id', authenticate, validate(uuidParamSchema, 'params'), deleteCompany);

export default router;
