import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * Test Routes (for demonstrating authentication)
 */

/**
 * Public test endpoint (no authentication required)
 * GET /api/test/public
 */
router.get('/public', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This is a public endpoint. No authentication required.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Protected test endpoint (authentication required)
 * GET /api/test/protected
 */
router.get('/protected', authenticate, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This is a protected endpoint. Authentication required.',
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Admin-only test endpoint (authentication + admin role required)
 * GET /api/test/admin
 */
router.get('/admin', authenticate, authorize(['admin']), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This is an admin-only endpoint.',
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Broker/Admin test endpoint (authentication + broker or admin role required)
 * GET /api/test/broker
 */
router.get('/broker', authenticate, authorize(['admin', 'broker']), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This endpoint requires broker or admin role.',
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

export default router;
