import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 *
 * Returns server status and basic system info
 */
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Test Supabase connection
    const { error } = await supabase.from('profiles').select('count').limit(1);
    const dbStatus = error ? 'disconnected' : 'connected';
    const dbMessage = error ? error.message : 'OK';

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        message: dbMessage,
      },
      version: '1.0.0',
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: 'Service unavailable',
    });
  }
});

/**
 * Readiness probe endpoint (for Kubernetes/Docker)
 * GET /api/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if database is ready
    const { error } = await supabase.from('profiles').select('count').limit(1);

    if (error) {
      return res.status(503).json({ ready: false, reason: 'Database not ready' });
    }

    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Service initialization failed' });
  }
});

/**
 * Liveness probe endpoint (for Kubernetes/Docker)
 * GET /api/alive
 */
router.get('/alive', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;
