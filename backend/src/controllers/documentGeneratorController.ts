import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import {
  generateContentBatch,
  ContentType,
  BatchGenerationResult,
} from '../services/contentGenerationService';

const VALID_CONTENT_TYPES: ContentType[] = [
  'property_description',
  'executive_summary',
  'location_analysis',
  'property_highlights',
  'market_analysis',
  'team_intro',
];

const VALID_TEMPLATE_TYPES = ['brochure', 'om', 'proposal'];

/**
 * Generate AI content for a property
 * POST /api/generate/content
 */
export const generateContent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { master_property_id, content_types, style_prompt } = req.body;

    if (!master_property_id) {
      throw new AppError(400, 'master_property_id is required');
    }

    if (!content_types || !Array.isArray(content_types) || content_types.length === 0) {
      throw new AppError(400, 'content_types must be a non-empty array');
    }

    // Validate content types
    const invalidTypes = content_types.filter((ct: string) => !VALID_CONTENT_TYPES.includes(ct as ContentType));
    if (invalidTypes.length > 0) {
      throw new AppError(400, `Invalid content types: ${invalidTypes.join(', ')}`);
    }

    // Fetch property
    const { data: property, error: propError } = await supabaseAdmin
      .from('master_properties')
      .select('*')
      .eq('id', master_property_id)
      .eq('is_deleted', false)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Fetch latest transaction
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('property_id', master_property_id)
      .order('transaction_date', { ascending: false })
      .limit(1);

    const transaction = transactions?.[0] || undefined;

    // Fetch user profile for company info (needed for team_intro)
    let companyInfo = {};
    if (content_types.includes('team_intro')) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('company_name, company_phone, company_email, company_address')
        .eq('id', req.user.id)
        .single();

      if (profile) {
        companyInfo = profile;
      }
    }

    console.log(`[DocGenerator] Generating content for property ${master_property_id}, types: ${content_types.join(', ')}`);

    const results: BatchGenerationResult = await generateContentBatch(
      property,
      content_types as ContentType[],
      req.user.id,
      transaction,
      companyInfo,
      style_prompt || undefined
    );

    // Build response with property data included
    res.status(200).json({
      success: true,
      property: {
        id: property.id,
        address: property.address,
        property_name: property.property_name,
        city: property.city,
        state: property.state,
        zip: property.zip,
        property_type: property.property_type,
        property_subtype: property.property_subtype,
        building_size: property.building_size,
        lot_size_acres: property.lot_size_acres,
        year_built: property.year_built,
        clear_height_ft: property.clear_height_ft,
        dock_doors: property.dock_doors,
        grade_doors: property.grade_doors,
        percent_leased: property.percent_leased,
        parking_spaces: property.parking_spaces,
        zoning: property.zoning,
        owner_name: property.owner_name,
      },
      transaction: transaction ? {
        sale_price: transaction.sale_price,
        asking_price: transaction.asking_price,
        price_per_sf: transaction.price_per_sf,
        cap_rate: transaction.cap_rate,
        noi: transaction.noi,
        transaction_type: transaction.transaction_type,
        transaction_date: transaction.transaction_date,
      } : null,
      content: results,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[DocGenerator] Content generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate content' });
    }
  }
};

/**
 * Save a generated document record
 * POST /api/generate/save
 */
export const saveDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { master_property_id, template_type, title, file_url, content_snapshot } = req.body;

    if (!template_type || !VALID_TEMPLATE_TYPES.includes(template_type)) {
      throw new AppError(400, `template_type must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}`);
    }

    if (!title) {
      throw new AppError(400, 'title is required');
    }

    const { data: doc, error: saveError } = await supabaseAdmin
      .from('generated_documents')
      .insert({
        master_property_id: master_property_id || null,
        template_type,
        title,
        file_url: file_url || null,
        content_snapshot: content_snapshot || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[DocGenerator] Save error:', saveError);
      throw new AppError(500, 'Failed to save document');
    }

    res.status(201).json({
      success: true,
      message: 'Document saved successfully',
      document: doc,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[DocGenerator] Save error:', error);
      res.status(500).json({ success: false, error: 'Failed to save document' });
    }
  }
};

/**
 * List generated documents
 * GET /api/generate/documents
 */
export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { master_property_id, template_type } = req.query;

    let query = supabaseAdmin
      .from('generated_documents')
      .select('*, master_properties(address, city, state, property_name)')
      // .eq('created_by', req.user.id) // open access mode
      .order('created_at', { ascending: false });

    if (master_property_id) {
      query = query.eq('master_property_id', master_property_id as string);
    }

    if (template_type && VALID_TEMPLATE_TYPES.includes(template_type as string)) {
      query = query.eq('template_type', template_type as string);
    }

    const { data: documents, error } = await query;

    if (error) {
      throw new AppError(500, 'Failed to fetch documents');
    }

    res.status(200).json({
      success: true,
      documents: documents || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
  }
};

/**
 * Get single generated document
 * GET /api/generate/documents/:id
 */
export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    const { data: doc, error } = await supabaseAdmin
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      // .eq('created_by', req.user.id) // open access mode
      .single();

    if (error || !doc) {
      throw new AppError(404, 'Document not found');
    }

    res.status(200).json({
      success: true,
      document: doc,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch document' });
    }
  }
};

/**
 * Delete a generated document
 * DELETE /api/generate/documents/:id
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Verify ownership
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('generated_documents')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !doc) {
      throw new AppError(404, 'Document not found');
    }

    const { error: deleteError } = await supabaseAdmin
      .from('generated_documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new AppError(500, 'Failed to delete document');
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
  }
};
