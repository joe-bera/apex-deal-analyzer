import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const BUCKET = 'executive-summaries';

/**
 * Get signed URL for direct PDF upload to Supabase Storage.
 * POST /api/executive-summaries/upload-url
 */
export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { property_id, file_name } = req.body;
    if (!property_id || !file_name) {
      throw new AppError(400, 'property_id and file_name are required');
    }

    const timestamp = Date.now();
    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `properties/${property_id}/${timestamp}-${sanitizedFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('Failed to create exec summary upload URL:', error);
      throw new AppError(500, 'Failed to create upload URL');
    }

    res.status(200).json({
      success: true,
      upload_url: data.signedUrl,
      storage_path: storagePath,
      token: data.token,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Get exec summary upload URL error:', error);
      res.status(500).json({ success: false, error: 'Failed to create upload URL' });
    }
  }
};

/**
 * Create executive summary record after upload.
 * POST /api/executive-summaries
 */
export const createSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { property_id, owner_name, honorific, entity_name, storage_path, file_name } = req.body;

    if (!property_id || !owner_name || !storage_path || !file_name) {
      throw new AppError(400, 'property_id, owner_name, storage_path, and file_name are required');
    }

    // Get public URL for the stored file
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storage_path);

    const { data, error } = await supabaseAdmin
      .from('executive_summaries')
      .insert({
        property_id,
        owner_name,
        honorific: honorific || 'Mr.',
        entity_name: entity_name || null,
        storage_path,
        file_name,
        file_url: publicUrl,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create exec summary record:', error);
      throw new AppError(500, 'Failed to save executive summary');
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Create exec summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to save executive summary' });
    }
  }
};

/**
 * List executive summaries for a property.
 * GET /api/executive-summaries/:propertyId
 */
export const listSummaries = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { propertyId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('executive_summaries')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list exec summaries:', error);
      throw new AppError(500, 'Failed to fetch executive summaries');
    }

    res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('List exec summaries error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch executive summaries' });
    }
  }
};

/**
 * Delete an executive summary.
 * DELETE /api/executive-summaries/:id
 */
export const deleteSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    // Get record to find storage path
    const { data: record } = await supabaseAdmin
      .from('executive_summaries')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (!record) throw new AppError(404, 'Executive summary not found');

    // Delete from storage
    await supabaseAdmin.storage.from(BUCKET).remove([record.storage_path]);

    // Delete DB record
    const { error } = await supabaseAdmin
      .from('executive_summaries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete exec summary:', error);
      throw new AppError(500, 'Failed to delete executive summary');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Delete exec summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete executive summary' });
    }
  }
};
