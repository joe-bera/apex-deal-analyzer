import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPipelineForecast,
  getBrokerProduction,
  getRevenueReport,
  getActivitySummary,
  getPropertyAnalytics,
  getProspectingReport,
  exportReportCSV,
} from '../controllers/reportsController';

const router = Router();

// Report endpoints
router.get('/pipeline-forecast', authenticate, getPipelineForecast);
router.get('/broker-production', authenticate, getBrokerProduction);
router.get('/revenue', authenticate, getRevenueReport);
router.get('/activity-summary', authenticate, getActivitySummary);
router.get('/property-analytics', authenticate, getPropertyAnalytics);
router.get('/prospecting', authenticate, getProspectingReport);

// CSV export (must come after named routes to avoid param collision)
router.get('/:type/export', authenticate, exportReportCSV);

export default router;
