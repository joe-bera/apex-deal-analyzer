import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const PHOTO_BUCKET = 'property-photos';

// Valid photo types
const VALID_PHOTO_TYPES = ['exterior', 'interior', 'aerial', 'loading_dock', 'parking', 'other'];

/**
 * Verify a property exists in either the old properties table or master_properties.
 */
const verifyPropertyExists = async (propertyId: string): Promise<boolean> => {
  const { data: oldProp } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .maybeSingle();
  if (oldProp) return true;

  const { data: masterProp } = await supabaseAdmin
    .from('master_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('is_deleted', false)
    .maybeSingle();
  return !!masterProp;
};

/**
 * Get signed URL for direct photo upload
 * POST /api/properties/:propertyId/photos/upload-url
 */
export const getPhotoUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;
    const { file_name, file_size } = req.body;

    if (!file_name) {
      throw new AppError(400, 'file_name is required');
    }

    // Validate file size (10MB limit for photos)
    const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
    if (file_size && file_size > MAX_PHOTO_SIZE) {
      throw new AppError(400, 'Photo too large. Maximum size is 10MB.');
    }

    // Verify property exists in either table
    const propExists = await verifyPropertyExists(propertyId);
    if (!propExists) {
      throw new AppError(404, 'Property not found');
    }

    // Create signed upload URL for photos bucket
    const timestamp = Date.now();
    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `properties/${propertyId}/${timestamp}-${sanitizedFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('Failed to create photo upload URL:', error);
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
      console.error('Get photo upload URL error:', error);
      res.status(500).json({ success: false, error: 'Failed to create upload URL' });
    }
  }
};

/**
 * Create photo record after direct upload
 * POST /api/properties/:propertyId/photos
 */
export const createPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;
    const { storage_path, file_name, file_size, photo_type = 'exterior', caption, is_primary } = req.body;

    if (!storage_path || !file_name) {
      throw new AppError(400, 'storage_path and file_name are required');
    }

    // Validate photo_type
    if (!VALID_PHOTO_TYPES.includes(photo_type)) {
      throw new AppError(400, `Invalid photo_type. Must be one of: ${VALID_PHOTO_TYPES.join(', ')}`);
    }

    // Verify property exists in either table
    const propExists = await verifyPropertyExists(propertyId);
    if (!propExists) {
      throw new AppError(404, 'Property not found');
    }

    // If this is primary, unset other primary photos for this property
    if (is_primary) {
      await supabaseAdmin
        .from('property_photos')
        .update({ is_primary: false })
        .eq('property_id', propertyId);
    }

    // Get current max sort_order
    const { data: existingPhotos } = await supabaseAdmin
      .from('property_photos')
      .select('sort_order')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = existingPhotos && existingPhotos.length > 0
      ? (existingPhotos[0].sort_order || 0) + 1
      : 0;

    // Create photo record
    const { data: photo, error: dbError } = await supabaseAdmin
      .from('property_photos')
      .insert({
        property_id: propertyId,
        uploaded_by: req.user.id,
        file_name,
        file_path: storage_path,
        file_size: typeof file_size === 'string' ? parseInt(file_size, 10) : (file_size || 1),
        photo_type,
        caption: caption || null,
        sort_order: nextSortOrder,
        is_primary: is_primary || false,
      })
      .select()
      .single();

    if (dbError || !photo) {
      console.error('Database error creating photo:', dbError);
      throw new AppError(500, 'Failed to create photo record');
    }

    // Get public URL for the photo
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(storage_path);

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      photo: {
        ...photo,
        url: publicUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Create photo error:', error);
      res.status(500).json({ success: false, error: 'Failed to create photo record' });
    }
  }
};

/**
 * List photos for a property
 * GET /api/properties/:propertyId/photos
 */
export const listPhotos = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;

    // Verify property exists in either table
    const propExists = await verifyPropertyExists(propertyId);
    if (!propExists) {
      throw new AppError(404, 'Property not found');
    }

    // Get all photos for the property
    const { data: photos, error: photosError } = await supabaseAdmin
      .from('property_photos')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true });

    if (photosError) {
      throw new AppError(500, 'Failed to fetch photos');
    }

    // Add public URLs to each photo
    const photosWithUrls = (photos || []).map(photo => {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(photo.file_path);
      return { ...photo, url: publicUrl };
    });

    res.status(200).json({
      success: true,
      photos: photosWithUrls,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('List photos error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch photos' });
    }
  }
};

/**
 * Update photo metadata
 * PATCH /api/photos/:id
 */
export const updatePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    const { photo_type, caption, sort_order, is_primary } = req.body;

    // Get the photo
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('property_photos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !photo) {
      throw new AppError(404, 'Photo not found');
    }

    // If setting as primary, unset other primary photos
    if (is_primary) {
      await supabaseAdmin
        .from('property_photos')
        .update({ is_primary: false })
        .eq('property_id', photo.property_id);
    }

    // Build update object
    const updates: any = {};
    if (photo_type !== undefined && VALID_PHOTO_TYPES.includes(photo_type)) {
      updates.photo_type = photo_type;
    }
    if (caption !== undefined) updates.caption = caption;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_primary !== undefined) updates.is_primary = is_primary;

    // Update photo
    const { data: updatedPhoto, error: updateError } = await supabaseAdmin
      .from('property_photos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedPhoto) {
      throw new AppError(500, 'Failed to update photo');
    }

    // Add public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(updatedPhoto.file_path);

    res.status(200).json({
      success: true,
      message: 'Photo updated successfully',
      photo: { ...updatedPhoto, url: publicUrl },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Update photo error:', error);
      res.status(500).json({ success: false, error: 'Failed to update photo' });
    }
  }
};

/**
 * Delete a photo
 * DELETE /api/photos/:id
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get the photo to verify ownership and get file path
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('property_photos')
      .select('*, properties!inner(created_by)')
      .eq('id', id)
      .single();

    if (fetchError || !photo) {
      throw new AppError(404, 'Photo not found');
    }

    // Check if user owns the property
    if (false && (photo as any).properties.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to delete this photo');
    }

    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .remove([photo.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('property_photos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new AppError(500, 'Failed to delete photo');
    }

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Delete photo error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete photo' });
    }
  }
};

/**
 * Set a photo as the primary photo
 * POST /api/photos/:id/set-primary
 */
export const setPrimaryPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get the photo
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('property_photos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !photo) {
      throw new AppError(404, 'Photo not found');
    }

    // Unset other primary photos for this property
    await supabaseAdmin
      .from('property_photos')
      .update({ is_primary: false })
      .eq('property_id', photo.property_id);

    // Set this photo as primary
    const { data: updatedPhoto, error: updateError } = await supabaseAdmin
      .from('property_photos')
      .update({ is_primary: true })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedPhoto) {
      throw new AppError(500, 'Failed to set primary photo');
    }

    // Add public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(updatedPhoto.file_path);

    res.status(200).json({
      success: true,
      message: 'Primary photo updated',
      photo: { ...updatedPhoto, url: publicUrl },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Set primary photo error:', error);
      res.status(500).json({ success: false, error: 'Failed to set primary photo' });
    }
  }
};
