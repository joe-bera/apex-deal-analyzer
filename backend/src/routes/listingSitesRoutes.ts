import { Router } from 'express';
import {
  createListingSite,
  listListingSites,
  getListingSite,
  updateListingSite,
  deleteListingSite,
  getListingLeads,
} from '../controllers/listingSitesController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createListingSite);
router.get('/', authenticate, listListingSites);
router.get('/:id', authenticate, getListingSite);
router.patch('/:id', authenticate, updateListingSite);
router.delete('/:id', authenticate, deleteListingSite);
router.get('/:id/leads', authenticate, getListingLeads);

export default router;
