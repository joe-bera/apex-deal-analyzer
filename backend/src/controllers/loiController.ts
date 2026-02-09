import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { generateLOI, generateLOITemplate } from '../services/loiService';

/**
 * Generate Letter of Intent for a property
 * POST /api/properties/:propertyId/loi
 */
export const generatePropertyLOI = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;
    const { buyer_info, offer_params, use_ai = false } = req.body;

    // Validate buyer info
    if (!buyer_info?.buyer_name) {
      throw new AppError(400, 'Buyer name is required');
    }

    // Validate offer params
    if (!offer_params?.offer_price || offer_params.offer_price <= 0) {
      throw new AppError(400, 'Valid offer price is required');
    }

    // Get property
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    console.log(`[LOI] Generating LOI for property ${propertyId}, use_ai: ${use_ai}`);

    // Generate LOI (use template by default, AI if requested)
    const loi = use_ai
      ? await generateLOI(property, buyer_info, offer_params)
      : generateLOITemplate(property, buyer_info, offer_params);

    // Save LOI to database
    const { data: savedLoi, error: saveError } = await supabaseAdmin
      .from('lois')
      .insert({
        property_id: propertyId,
        created_by: req.user.id,
        buyer_name: buyer_info.buyer_name,
        buyer_company: buyer_info.buyer_company,
        buyer_email: buyer_info.buyer_email,
        offer_price: loi.offer_price,
        earnest_money: loi.earnest_money,
        due_diligence_days: loi.due_diligence_days,
        closing_days: loi.closing_days,
        contingencies: loi.contingencies,
        loi_html: loi.loi_html,
        loi_text: loi.loi_text,
        status: 'draft',
      })
      .select()
      .single();

    if (saveError) {
      console.error('[LOI] Failed to save LOI:', saveError);
      // Don't fail - still return the generated LOI
    }

    res.status(200).json({
      success: true,
      message: 'LOI generated successfully',
      loi: {
        ...loi,
        id: savedLoi?.id,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[LOI] Generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate LOI' });
    }
  }
};

/**
 * Get all LOIs for a property
 * GET /api/properties/:propertyId/lois
 */
export const getPropertyLOIs = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { propertyId } = req.params;

    // Verify property access
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, created_by')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Get LOIs
    const { data: lois, error: loisError } = await supabaseAdmin
      .from('lois')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (loisError) {
      throw new AppError(500, 'Failed to fetch LOIs');
    }

    res.status(200).json({
      success: true,
      lois: lois || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch LOIs' });
    }
  }
};

/**
 * Update LOI status
 * PATCH /api/lois/:loiId
 */
export const updateLOI = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { loiId } = req.params;
    const { status } = req.body;

    // Get LOI
    const { data: loi, error: fetchError } = await supabaseAdmin
      .from('lois')
      .select('*')
      .eq('id', loiId)
      .single();

    if (fetchError || !loi) {
      throw new AppError(404, 'LOI not found');
    }

    // Update LOI
    const { data: updatedLoi, error: updateError } = await supabaseAdmin
      .from('lois')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', loiId)
      .select()
      .single();

    if (updateError) {
      throw new AppError(500, 'Failed to update LOI');
    }

    res.status(200).json({
      success: true,
      message: 'LOI updated successfully',
      loi: updatedLoi,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update LOI' });
    }
  }
};
