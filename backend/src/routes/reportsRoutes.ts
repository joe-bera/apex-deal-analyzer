import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
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
router.get('/pipeline-forecast', optionalAuth, getPipelineForecast);
router.get('/broker-production', optionalAuth, getBrokerProduction);
router.get('/revenue', optionalAuth, getRevenueReport);
router.get('/activity-summary', optionalAuth, getActivitySummary);
router.get('/property-analytics', optionalAuth, getPropertyAnalytics);
router.get('/prospecting', optionalAuth, getProspectingReport);

// CSV export (must come after named routes to avoid param collision)
router.get('/:type/export', optionalAuth, exportReportCSV);

export default router;
