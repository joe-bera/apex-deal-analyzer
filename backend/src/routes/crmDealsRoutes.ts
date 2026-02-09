import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
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
router.get('/', optionalAuth, listCrmDeals);
router.get('/pipeline', optionalAuth, getPipeline);
router.get('/analytics', optionalAuth, getAnalytics);

// CRUD
router.get('/:id', optionalAuth, validate(uuidParamSchema, 'params'), getCrmDeal);
router.post('/', optionalAuth, validate(createCrmDealSchema, 'body'), createCrmDeal);
router.patch('/:id', optionalAuth, validate(uuidParamSchema, 'params'), validate(updateCrmDealSchema, 'body'), updateCrmDeal);
router.patch('/:id/stage', optionalAuth, validate(uuidParamSchema, 'params'), validate(updateDealStageSchema, 'body'), updateDealStage);
router.delete('/:id', optionalAuth, validate(uuidParamSchema, 'params'), deleteCrmDeal);

// Deal contacts
router.post('/:id/contacts', optionalAuth, validate(uuidParamSchema, 'params'), validate(addDealContactSchema, 'body'), addDealContact);
router.delete('/:id/contacts/:dcId', optionalAuth, removeDealContact);

export default router;
