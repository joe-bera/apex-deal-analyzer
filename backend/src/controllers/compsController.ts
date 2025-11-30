import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * Get all comps for a property
 * GET /api/properties/:propertyId/comps
 */
export const getCompsForProperty = async (req: Request, res: Response): Promise<void> => {
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

    // Get all comps for this property
    const { data: comps, error: compsError } = await supabaseAdmin
      .from('comps')
      .select('*')
      .eq('property_id', propertyId)
      .order('comp_sale_date', { ascending: false });

    if (compsError) {
      console.error('Error fetching comps:', compsError);
      throw new AppError(500, 'Failed to fetch comps');
    }

    res.status(200).json({
      success: true,
      comps: comps || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Add a comp to a property
 * POST /api/properties/:propertyId/comps
 */
export const addCompToProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;
    const compData = req.body;

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

    // Validate required fields
    if (!compData.comp_address || !compData.comp_city || !compData.comp_state) {
      throw new AppError(400, 'Address, city, and state are required');
    }

    if (!compData.comp_sale_price || !compData.comp_sale_date) {
      throw new AppError(400, 'Sale price and sale date are required');
    }

    if (!compData.comp_property_type) {
      throw new AppError(400, 'Property type is required');
    }

    // Insert comp
    const { data: comp, error: insertError } = await supabaseAdmin
      .from('comps')
      .insert({
        property_id: propertyId,
        created_by: req.user.id,
        ...compData,
      })
      .select()
      .single();

    if (insertError || !comp) {
      console.error('Error creating comp:', insertError);
      throw new AppError(500, 'Failed to create comp');
    }

    res.status(201).json({
      success: true,
      message: 'Comp added successfully',
      comp,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Update a comp
 * PATCH /api/comps/:compId
 */
export const updateComp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { compId } = req.params;
    const updates = req.body;

    // Verify comp exists and user owns it
    const { data: existingComp, error: fetchError } = await supabaseAdmin
      .from('comps')
      .select('*')
      .eq('id', compId)
      .single();

    if (fetchError || !existingComp) {
      throw new AppError(404, 'Comp not found');
    }

    if (existingComp.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to update this comp');
    }

    // Update comp
    const { data: comp, error: updateError } = await supabaseAdmin
      .from('comps')
      .update(updates)
      .eq('id', compId)
      .select()
      .single();

    if (updateError || !comp) {
      console.error('Error updating comp:', updateError);
      throw new AppError(500, 'Failed to update comp');
    }

    res.status(200).json({
      success: true,
      message: 'Comp updated successfully',
      comp,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete a comp
 * DELETE /api/comps/:compId
 */
export const deleteComp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { compId } = req.params;

    // Verify comp exists and user owns it
    const { data: existingComp, error: fetchError } = await supabaseAdmin
      .from('comps')
      .select('created_by')
      .eq('id', compId)
      .single();

    if (fetchError || !existingComp) {
      throw new AppError(404, 'Comp not found');
    }

    if (existingComp.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to delete this comp');
    }

    // Delete comp
    const { error: deleteError } = await supabaseAdmin
      .from('comps')
      .delete()
      .eq('id', compId);

    if (deleteError) {
      console.error('Error deleting comp:', deleteError);
      throw new AppError(500, 'Failed to delete comp');
    }

    res.status(200).json({
      success: true,
      message: 'Comp deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
