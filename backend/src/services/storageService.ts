import fs from 'fs';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const STORAGE_BUCKET = 'documents';

/**
 * Upload file to Supabase Storage
 *
 * @param filePath - Local file path
 * @param fileName - Desired filename in storage
 * @param userId - User ID for organizing files
 * @returns Public URL of uploaded file
 */
export const uploadToStorage = async (
  filePath: string,
  fileName: string,
  userId: string
): Promise<{ filePath: string; publicUrl: string }> => {
  try {
    // Read file from disk
    const fileBuffer = fs.readFileSync(filePath);

    // Generate storage path: users/{userId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const storagePath = `users/${userId}/${timestamp}-${fileName}`;

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
