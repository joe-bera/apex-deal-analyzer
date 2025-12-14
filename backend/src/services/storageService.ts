import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const STORAGE_BUCKET = 'documents';

/**
 * Upload file buffer to Supabase Storage
 *
 * @param fileBuffer - File buffer (from multer memory storage)
 * @param fileName - Desired filename in storage
 * @param userId - User ID for organizing files
 * @returns Public URL of uploaded file
 */
export const uploadToStorage = async (
  fileBuffer: Buffer,
  fileName: string,
  userId: string
): Promise<{ filePath: string; publicUrl: string }> => {
  try {
    // Generate storage path: users/{userId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `users/${userId}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new AppError(500, `Storage upload failed: ${error.message}`);
    }

    if (!data) {
      throw new AppError(500, 'Storage upload failed: No data returned');
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      filePath: storagePath,
      publicUrl,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, 'Failed to upload file to storage');
  }
};

/**
 * Delete file from Supabase Storage
 *
 * @param filePath - Storage file path
 */
export const deleteFromStorage = async (filePath: string): Promise<void> => {
  try {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Storage deletion error:', error);
      throw new AppError(500, `Storage deletion failed: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Failed to delete file from storage:', error);
  }
};

/**
 * Get signed URL for private file access
 *
 * @param filePath - Storage file path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL
 */
export const getSignedUrl = async (
  filePath: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error || !data) {
      throw new AppError(500, 'Failed to generate signed URL');
    }

    return data.signedUrl;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, 'Failed to generate signed URL');
  }
};

/**
 * Create a signed upload URL for direct client-side upload
 * This bypasses the backend for file data, avoiding proxy issues
 *
 * @param fileName - Original filename
 * @param userId - User ID for organizing files
 * @returns Signed upload URL and the storage path
 */
export const createSignedUploadUrl = async (
  fileName: string,
  userId: string
): Promise<{ signedUrl: string; storagePath: string; token: string }> => {
  try {
    // Generate storage path: users/{userId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `users/${userId}/${timestamp}-${sanitizedFileName}`;

    // Create signed upload URL (valid for 1 hour)
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('Failed to create signed upload URL:', error);
      throw new AppError(500, 'Failed to create upload URL');
    }

    return {
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, 'Failed to create upload URL');
  }
};

/**
 * Get public URL for a storage path
 */
export const getPublicUrl = (storagePath: string): string => {
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);
  return publicUrl;
};

/**
 * Get a signed download URL for reading a file (works even if bucket is private)
 */
export const getSignedDownloadUrl = async (storagePath: string): Promise<string> => {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 3600); // 1 hour

  if (error || !data) {
    throw new AppError(500, 'Failed to create download URL');
  }

  return data.signedUrl;
};
