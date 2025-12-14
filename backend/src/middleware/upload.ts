import multer from 'multer';
import path from 'path';
import { config } from '../config/env';
import { AppError } from './errorHandler';

/**
 * Multer configuration for PDF uploads
 * Uses memory storage for cloud deployment compatibility (Railway, etc.)
 * Files are stored in memory as Buffer, then uploaded to Supabase Storage
 */
const storage = multer.memoryStorage();

/**
 * File filter - only allow PDF files
 */
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check MIME type
  if (file.mimetype !== 'application/pdf') {
    return cb(new AppError(400, 'Only PDF files are allowed'));
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    return cb(new AppError(400, 'Only PDF files are allowed'));
  }

  cb(null, true);
};

/**
 * Multer upload middleware
 * Configures file size limits and file type validation
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize, // 50 MB default
    files: 1, // Only one file per upload
  },
});
