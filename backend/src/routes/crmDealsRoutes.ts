import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  validate,
  uuidParamSchema,
  createCrmDealSchema,
  updateCrmDealSchema,
  updateDealStageSchema,
  addDealContactSchema,
} from '../middleware/validate';
import {
  listCrmDeals,
  getPipeline,
  getAnalytics,
  getCrmDeal,
  createCrmDeal,
  updateCrmDeal,
  updateDealStage,
  deleteCrmDeal,
  addDealContact,
  removeDealContact,
} from '../controllers/crmDealsController';

const router = Router();

// List & analytics (these must come before /:id to avoid param matching)
router.get('/', authenticate, listCrmDeals);
router.get('/pipeline', authenticate, getPipeline);
router.get('/analytics', authenticate, getAnalytics);

// CRUD
router.get('/:id', authenticate, validate(uuidParamSchema, 'params'), getCrmDeal);
router.post('/', authenticate, validate(createCrmDealSchema, 'body'), createCrmDeal);
router.patch('/:id', authenticate, validate(uuidParamSchema, 'params'), validate(updateCrmDealSchema, 'body'), updateCrmDeal);
router.patch('/:id/stage', authenticate, validate(uuidParamSchema, 'params'), validate(updateDealStageSchema, 'body'), updateDealStage);
router.delete('/:id', authenticate, validate(uuidParamSchema, 'params'), deleteCrmDeal);

// Deal contacts
router.post('/:id/contacts', authenticate, validate(uuidParamSchema, 'params'), validate(addDealContactSchema, 'body'), addDealContact);
router.delete('/:id/contacts/:dcId', authenticate, removeDealContact);

export default router;
