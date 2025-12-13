import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}\n` +
    `Please copy .env.example to .env and fill in the values.`
  );
}

// Warn about optional but important env vars
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    '⚠️  WARNING: ANTHROPIC_API_KEY is not set. AI extraction and valuation features will fail.'
  );
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set to a secure value in production');
  }
}

// Export configuration object
export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiration: process.env.JWT_EXPIRATION || '24h',
  },
  upload: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10 MB default
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'application/pdf').split(','),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20', 10),
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

// Log configuration on startup (mask sensitive values)
if (config.server.isDevelopment) {
  console.log('Configuration loaded:');
  console.log(`- Server port: ${config.server.port}`);
  console.log(`- Node environment: ${config.server.nodeEnv}`);
  console.log(`- Supabase URL: ${config.supabase.url}`);
  console.log(`- Max file size: ${config.upload.maxFileSize} bytes`);
  console.log(`- CORS origin: ${config.cors.origin}`);
}
