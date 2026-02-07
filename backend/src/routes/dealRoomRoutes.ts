import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDealRoom,
  getUploadUrl,
  addDocument,
  deleteDocument,
  createInvite,
  revokeInvite,
  getActivityLog,
  getPublicDealRoom,
  logPublicDownload,
} from '../controllers/dealRoomController';

const router = Router();

// Authenticated routes (mounted under /api/crm-deals/:dealId/room)
router.get('/:dealId/room', authenticate, getDealRoom);
router.post('/:dealId/room/upload-url', authenticate, getUploadUrl);
router.post('/:dealId/room/documents', authenticate, addDocument);
router.delete('/:dealId/room/documents/:docId', authenticate, deleteDocument);
router.post('/:dealId/room/invites', authenticate, createInvite);
router.delete('/:dealId/room/invites/:inviteId', authenticate, revokeInvite);
router.get('/:dealId/room/activity', authenticate, getActivityLog);

export default router;

// Public routes (mounted separately)
export const publicDealRoomRouter = Router();
publicDealRoomRouter.get('/:token', getPublicDealRoom);
publicDealRoomRouter.post('/:token/download/:docId', logPublicDownload);
