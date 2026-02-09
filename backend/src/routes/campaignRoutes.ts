import { Router } from 'express';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  generateContent,
  addRecipients,
  removeRecipient,
  sendCampaign,
  handleUnsubscribe,
} from '../controllers/campaignController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Public endpoint — before auth middleware (CAN-SPAM compliance)
router.post('/unsubscribe', handleUnsubscribe);

// All routes below require authentication
router.use(optionalAuth);

// Campaign CRUD
router.get('/', listCampaigns);
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.patch('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// AI content generation
router.post('/generate-content', generateContent);

// Recipients
router.post('/:id/recipients', addRecipients);
router.delete('/:id/recipients/:recipientId', removeRecipient);

// Send
router.post('/:id/send', sendCampaign);

export default router;
