import { Router } from 'express';
import {
  createListingSite,
  listListingSites,
  getListingSite,
  updateListingSite,
  deleteListingSite,
  getListingLeads,
} from '../controllers/listingSitesController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuth, createListingSite);
router.get('/', optionalAuth, listListingSites);
router.get('/:id', optionalAuth, getListingSite);
router.patch('/:id', optionalAuth, updateListingSite);
router.delete('/:id', optionalAuth, deleteListingSite);
router.get('/:id/leads', optionalAuth, getListingLeads);

export default router;
