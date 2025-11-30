import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { AppError } from './errorHandler';

// Ensure upload directory exists
const uploadDir = path.resolve(config.upload.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Multer configuration for PDF uploads
 * - Stores files temporarily in local uploads directory
 * - Files will be moved to Supabase Storage after processing
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

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
    fileSize: config.upload.maxFileSize, // 10 MB default
    files: 1, // Only one file per upload
  },
});

/**
 * Cleanup helper - deletes temporary uploaded file
 */
export const cleanupFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};
