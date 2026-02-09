import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';

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
 * Protected test endpoint
 * GET /api/test/protected
 */
router.get('/protected', optionalAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This endpoint uses optional auth.',
    user: req.user || null,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Admin test endpoint
 * GET /api/test/admin
 */
router.get('/admin', optionalAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This endpoint uses optional auth.',
    user: req.user || null,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Broker test endpoint
 * GET /api/test/broker
 */
router.get('/broker', optionalAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This endpoint uses optional auth.',
    user: req.user || null,
    timestamp: new Date().toISOString(),
  });
});

export default router;
