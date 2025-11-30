import { createApp } from './app';
import { config } from './config/env';

/**
 * Start the Express server
 */
const startServer = () => {
  const app = createApp();
  const port = config.server.port;

  app.listen(port, () => {
    console.log('=================================');
    console.log('🚀 Apex Deal Analyzer API Server');
    console.log('=================================');
    console.log(`Environment: ${config.server.nodeEnv}`);
    console.log(`Server running on port: ${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
    console.log('=================================');
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
