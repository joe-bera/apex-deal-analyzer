import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
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
router.get('/:dealId/room', optionalAuth, getDealRoom);
router.post('/:dealId/room/upload-url', optionalAuth, getUploadUrl);
router.post('/:dealId/room/documents', optionalAuth, addDocument);
router.delete('/:dealId/room/documents/:docId', optionalAuth, deleteDocument);
router.post('/:dealId/room/invites', optionalAuth, createInvite);
router.delete('/:dealId/room/invites/:inviteId', optionalAuth, revokeInvite);
router.get('/:dealId/room/activity', optionalAuth, getActivityLog);

export default router;

// Public routes (mounted separately)
export const publicDealRoomRouter = Router();
publicDealRoomRouter.get('/:token', getPublicDealRoom);
publicDealRoomRouter.post('/:token/download/:docId', logPublicDownload);
