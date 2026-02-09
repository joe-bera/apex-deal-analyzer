import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { validate, uuidParamSchema, createCompanySchema, updateCompanySchema } from '../middleware/validate';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../controllers/companiesController';

const router = Router();

router.get('/', optionalAuth, listCompanies);
router.get('/:id', optionalAuth, validate(uuidParamSchema, 'params'), getCompany);
router.post('/', optionalAuth, validate(createCompanySchema, 'body'), createCompany);
router.patch('/:id', optionalAuth, validate(uuidParamSchema, 'params'), validate(updateCompanySchema, 'body'), updateCompany);
router.delete('/:id', optionalAuth, validate(uuidParamSchema, 'params'), deleteCompany);

export default router;
