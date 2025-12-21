import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * Get deal analysis for a property
 * GET /api/properties/:propertyId/analysis
 */
export const getDealAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;

    // Verify property exists and user has access
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, created_by')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    if (property.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have access to this property');
    }

    // Get deal analysis for this property
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('deal_analyses')
      .select('*')
      .eq('property_id', propertyId)
      .eq('created_by', req.user.id)
      .single();

    if (analysisError && analysisError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Error fetching deal analysis:', analysisError);
      throw new AppError(500, 'Failed to fetch deal analysis');
    }

    res.status(200).json({
      success: true,
      analysis: analysis || null,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Unexpected error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Create or update deal analysis for a property (upsert)
 * PUT /api/properties/:propertyId/analysis
 */
export const saveDealAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;
    const analysisData = req.body;

    // Verify property exists and user has access
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, created_by')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    if (property.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have access to this property');
    }

    // Check if analysis already exists
    const { data: existing } = await supabaseAdmin
      .from('deal_analyses')
      .select('id')
      .eq('property_id', propertyId)
      .eq('created_by', req.user.id)
      .single();

    let analysis;
    let error;

    if (existing) {
      // Update existing analysis
      const result = await supabaseAdmin
        .from('deal_analyses')
        .update({
          ...analysisData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      analysis = result.data;
      error = result.error;
    } else {
      // Create new analysis
      const result = await supabaseAdmin
        .from('deal_analyses')
        .insert({
          property_id: propertyId,
          created_by: req.user.id,
          ...analysisData,
        })
        .select()
        .single();

      analysis = result.data;
      error = result.error;
    }

    if (error || !analysis) {
      console.error('Error saving deal analysis:', error);
      throw new AppError(500, 'Failed to save deal analysis');
    }

    res.status(200).json({
      success: true,
      message: existing ? 'Analysis updated successfully' : 'Analysis created successfully',
      analysis,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Unexpected error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete deal analysis for a property
 * DELETE /api/properties/:propertyId/analysis
 */
export const deleteDealAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;

    // Verify property exists and user has access
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, created_by')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    if (property.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have access to this property');
    }

    // Delete analysis
    const { error: deleteError } = await supabaseAdmin
      .from('deal_analyses')
      .delete()
      .eq('property_id', propertyId)
      .eq('created_by', req.user.id);

    if (deleteError) {
      console.error('Error deleting deal analysis:', deleteError);
      throw new AppError(500, 'Failed to delete deal analysis');
    }

    res.status(200).json({
      success: true,
      message: 'Deal analysis deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Unexpected error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
