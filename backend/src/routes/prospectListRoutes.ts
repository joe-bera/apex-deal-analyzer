import { Router } from 'express';
import {
  previewFilters,
  listProspectLists,
  createProspectList,
  getProspectList,
  updateProspectList,
  deleteProspectList,
  refreshProspectList,
  exportProspectList,
  updateProspectListItem,
  bulkUpdateItems,
} from '../controllers/prospectListController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Preview filters (before saving a list)
router.post('/preview', previewFilters);

// CRUD for prospect lists
router.get('/', listProspectLists);
router.post('/', createProspectList);
router.get('/:id', getProspectList);
router.patch('/:id', updateProspectList);
router.delete('/:id', deleteProspectList);

// Refresh list snapshot
router.post('/:id/refresh', refreshProspectList);

// Export list as CSV
router.get('/:id/export', exportProspectList);

// Bulk update items
router.post('/:id/bulk-update', bulkUpdateItems);

// Update individual item
router.patch('/:listId/items/:itemId', updateProspectListItem);

export default router;
