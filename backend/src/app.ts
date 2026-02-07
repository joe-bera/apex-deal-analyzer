import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import testRoutes from './routes/testRoutes';
import documentRoutes from './routes/documentRoutes';
import propertyRoutes from './routes/propertyRoutes';
import compsRoutes from './routes/compsRoutes';
import photoRoutes from './routes/photoRoutes';
import dealAnalysisRoutes from './routes/dealAnalysisRoutes';
import masterPropertyRoutes from './routes/masterPropertyRoutes';
import companiesRoutes from './routes/companiesRoutes';
import contactsRoutes from './routes/contactsRoutes';
import crmDealsRoutes from './routes/crmDealsRoutes';
import activitiesRoutes from './routes/activitiesRoutes';
import documentGeneratorRoutes from './routes/documentGeneratorRoutes';
import listingSitesRoutes from './routes/listingSitesRoutes';
import publicListingRoutes from './routes/publicListingRoutes';
import prospectListRoutes from './routes/prospectListRoutes';
import ownerResearchRoutes from './routes/ownerResearchRoutes';
import campaignRoutes from './routes/campaignRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // Trust proxy for Railway/cloud deployments (needed for rate limiting)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet()); // Set security headers

  // CORS configuration
  const allowedOrigins = [
    'http://localhost:3000',
    'https://apex-res.com',
    'https://www.apex-res.com',
    config.cors.origin,
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow specific origins
        if (allowedOrigins.indexOf(origin) !== -1) {
          return callback(null, true);
        }

        // Allow all Vercel deployments (production and preview)
        if (origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204,
    })
  );

  // Iframe compatibility headers
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://apex-res.com');
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.apex-res.com');
    next();
  });

  // Body parsing middleware - increased limit for large CoStar imports
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logging middleware (simple console logging in development)
  if (config.server.isDevelopment) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  // API Routes
  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/test', testRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/photos', photoRoutes);
  app.use('/api', compsRoutes);
  app.use('/api', dealAnalysisRoutes);
  app.use('/api/master-properties', masterPropertyRoutes);
  app.use('/api/companies', companiesRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/crm-deals', crmDealsRoutes);
  app.use('/api/activities', activitiesRoutes);
  app.use('/api/generate', documentGeneratorRoutes);
  app.use('/api/listing-sites', listingSitesRoutes);
  app.use('/api/public', publicListingRoutes);
  app.use('/api/prospect-lists', prospectListRoutes);
  app.use('/api/owner-research', ownerResearchRoutes);
  app.use('/api/campaigns', campaignRoutes);

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};
