import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { ExtractedPropertyData } from '../services/extractionService';
import { analyzePropertyValue } from '../services/valuationService';

// Database property_type enum values
type DatabasePropertyType = 'warehouse' | 'distribution_center' | 'manufacturing' | 'flex_space' | 'cold_storage' | 'other';

/**
 * Map extracted property types to database enum values
 * The extraction service returns broader categories, we need to map them to our industrial-focused enum
 */
const mapPropertyTypeToDatabase = (extractedType: string | undefined | null, subtype?: string): DatabasePropertyType => {
  if (!extractedType) {
    // Try to infer from subtype if property_type is null
    if (subtype) {
      const subtypeLower = subtype.toLowerCase();
      if (subtypeLower.includes('warehouse')) return 'warehouse';
      if (subtypeLower.includes('distribution')) return 'distribution_center';
      if (subtypeLower.includes('manufacturing') || subtypeLower.includes('factory')) return 'manufacturing';
      if (subtypeLower.includes('flex')) return 'flex_space';
      if (subtypeLower.includes('cold') || subtypeLower.includes('refrigerat') || subtypeLower.includes('freezer')) return 'cold_storage';
    }
    return 'other';
  }

  const typeLower = extractedType.toLowerCase();

  // Direct matches or mappings
  if (typeLower === 'warehouse') return 'warehouse';
  if (typeLower === 'distribution_center' || typeLower.includes('distribution')) return 'distribution_center';
  if (typeLower === 'manufacturing') return 'manufacturing';
  if (typeLower === 'flex_space' || typeLower.includes('flex')) return 'flex_space';
  if (typeLower === 'cold_storage' || typeLower.includes('cold')) return 'cold_storage';

  // Map broader extraction types to our industrial-focused types
  if (typeLower === 'industrial') {
    // Try to be more specific based on subtype
    if (subtype) {
      const subtypeLower = subtype.toLowerCase();
      if (subtypeLower.includes('warehouse')) return 'warehouse';
      if (subtypeLower.includes('distribution')) return 'distribution_center';
      if (subtypeLower.includes('manufacturing')) return 'manufacturing';
      if (subtypeLower.includes('flex')) return 'flex_space';
      if (subtypeLower.includes('cold')) return 'cold_storage';
    }
    return 'warehouse'; // Default industrial to warehouse
  }

  // Non-industrial types go to 'other'
  if (['office', 'retail', 'multifamily', 'land', 'mixed_use', 'residential'].includes(typeLower)) {
    return 'other';
  }

  return 'other';
};

/**
 * Create property from extracted document data
 * POST /api/properties/from-document/:documentId
 */
export const createPropertyFromDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { documentId } = req.params;
    const { overrides } = req.body; // Allow manual overrides of extracted data

    // Get document with extracted data
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new AppError(404, 'Document not found');
    }

    // Check access permission
    if (document.uploaded_by !== req.user.id) {
      throw new AppError(403, 'You do not have access to this document');
    }

    // Check if document has extracted structured data
    const structuredData = document.extracted_data?.structured_data as ExtractedPropertyData;
    if (!structuredData) {
      throw new AppError(
        400,
        'Document has no extracted property data. Please run extraction first.'
      );
    }

    // Merge extracted data with manual overrides
    const propertyData = {
      ...structuredData,
      ...overrides,
    };

    // Map the extracted property_type to database enum value
    const mappedPropertyType = mapPropertyTypeToDatabase(propertyData.property_type, propertyData.subtype);

    // Create property record
    const { data: property, error: createError } = await supabaseAdmin
      .from('master_properties')
      .insert({
        created_by: req.user.id,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state || 'CA',
        zip_code: propertyData.zip_code,
        apn: propertyData.apn,
        property_type: mappedPropertyType,
        subtype: propertyData.subtype,
        building_size: propertyData.building_size,
        lot_size: propertyData.lot_size,
        year_built: propertyData.year_built,
        stories: propertyData.stories,
        units: propertyData.units,
        price: propertyData.price,
        price_per_sqft: propertyData.price_per_sqft,
        cap_rate: propertyData.cap_rate,
        noi: propertyData.noi,
        gross_income: propertyData.gross_income,
        operating_expenses: propertyData.operating_expenses,
        occupancy_rate: propertyData.occupancy_rate,
        market: propertyData.market,
        submarket: propertyData.submarket,
        zoning: propertyData.zoning,
        parking_spaces: propertyData.parking_spaces,
        additional_data: {
          lease_rate_per_sqft: propertyData.lease_rate_per_sqft,
          lease_term_years: propertyData.lease_term_years,
          tenant_name: propertyData.tenant_name,
          sale_date: propertyData.sale_date,
          comparable_to: propertyData.comparable_to,
          amenities: propertyData.amenities,
          notes: propertyData.notes,
          confidence_scores: propertyData.confidence_scores,
          source_document_id: documentId,
        },
      })
      .select()
      .single();

    if (createError || !property) {
      console.error('Property creation error:', createError);
      throw new AppError(500, 'Failed to create property');
    }

    // Link document to property
    await supabaseAdmin
      .from('documents')
      .update({ property_id: property.id })
      .eq('id', documentId);

    res.status(201).json({
      success: true,
      message: 'Property created successfully from document data',
      property,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Create property error:', error);
      res.status(500).json({ success: false, error: 'Failed to create property' });
    }
  }
};

/**
 * Update property with manual edits
 * PATCH /api/properties/:id
 */
export const updateProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    const updates = req.body;

    // Get existing property to check ownership
    const { data: existingProperty, error: fetchError } = await supabaseAdmin
      .from('master_properties')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingProperty) {
      throw new AppError(404, 'Property not found');
    }

    // Check ownership
    if (existingProperty.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to edit this property');
    }

    // Merge additional_data if provided
    let mergedAdditionalData = existingProperty.additional_data;
    if (updates.additional_data) {
      mergedAdditionalData = {
        ...existingProperty.additional_data,
        ...updates.additional_data,
      };
      delete updates.additional_data; // Remove from updates to handle separately
    }

    // Update property
    const { data: property, error: updateError } = await supabaseAdmin
      .from('master_properties')
      .update({
        ...updates,
        additional_data: mergedAdditionalData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !property) {
      throw new AppError(500, 'Failed to update property');
    }

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      property,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Update property error:', error);
      res.status(500).json({ success: false, error: 'Failed to update property' });
    }
  }
};

/**
 * Get property by ID with all related documents
 * GET /api/properties/:id
 */
export const getProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get property
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('master_properties')
      .select('*')
      .eq('id', id)
      .single();

    if (propertyError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Check access permission
    if (property.created_by !== req.user.id) {
      // TODO: Check shared_access table for permission
      throw new AppError(403, 'You do not have access to this property');
    }

    res.status(200).json({
      success: true,
      property,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Get property error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch property' });
    }
  }
};

/**
 * List user's properties
 * GET /api/properties
 */
export const listProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const {
      property_type,
      status,
      city,
      market,
      min_price,
      max_price,
      min_building_size,
      max_building_size,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = supabaseAdmin
      .from('master_properties')
      .select('*', { count: 'exact' })
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (property_type) {
      query = query.eq('property_type', property_type as string);
    }

    if (status) {
      query = query.eq('status', status as string);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (market) {
      query = query.ilike('market', `%${market}%`);
    }

    if (min_price) {
      query = query.gte('price', parseFloat(min_price as string));
    }

    if (max_price) {
      query = query.lte('price', parseFloat(max_price as string));
    }

    if (min_building_size) {
      query = query.gte('building_size', parseFloat(min_building_size as string));
    }

    if (max_building_size) {
      query = query.lte('building_size', parseFloat(max_building_size as string));
    }

    // Pagination
    query = query.range(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string) - 1
    );

    const { data: properties, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error.message, error.details, error.hint);
      throw new AppError(500, `Failed to fetch properties: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      properties: properties || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('List properties error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch properties' });
    }
  }
};

/**
 * Delete property (soft delete)
 * DELETE /api/properties/:id
 */
export const deleteProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get property to check ownership
    const { data: property, error: fetchError } = await supabaseAdmin
      .from('master_properties')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Check ownership
    if (property.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to delete this property');
    }

    // Soft delete: mark as archived
    const { error: deleteError } = await supabaseAdmin
      .from('master_properties')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      throw new AppError(500, 'Failed to delete property');
    }

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Delete property error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete property' });
    }
  }
};

/**
 * Get latest valuation result for a property
 * GET /api/properties/:id/valuation
 */
export const getPropertyValuation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get property to check access
    const { data: property, error: propError } = await supabaseAdmin
      .from('master_properties')
      .select('created_by')
      .eq('id', id)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    if (property.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have access to this property');
    }

    // Get latest deal with valuation result
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('deals')
      .select('*')
      .eq('property_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dealError) {
      throw new AppError(500, 'Failed to fetch valuation');
    }

    res.status(200).json({
      success: true,
      valuation: deal?.valuation_result || null,
      deal_id: deal?.id || null,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Get valuation error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch valuation' });
    }
  }
};

/**
 * Analyze property value using AI and comps
 * POST /api/properties/:id/analyze
 */
export const analyzePropertyValuation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get property
    const { data: property, error: propError } = await supabaseAdmin
      .from('master_properties')
      .select('*')
      .eq('id', id)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Check access
    if (property.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have access to this property');
    }

    // Get all comps for this property
    const { data: comps, error: compsError } = await supabaseAdmin
      .from('comps')
      .select('*')
      .eq('property_id', id);

    if (compsError) {
      console.error('Error fetching comps:', compsError);
      throw new AppError(500, 'Failed to fetch comps');
    }

    if (!comps || comps.length === 0) {
      throw new AppError(400, 'No comparables found. Please add at least one comp before running analysis.');
    }

    console.log(`Analyzing property ${id} with ${comps.length} comps...`);

    // Run AI valuation analysis
    const valuation = await analyzePropertyValue(property, comps);

    // Save analysis result
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('deals')
      .insert({
        property_id: id,
        created_by: req.user.id,
        deal_name: `Valuation Analysis - ${new Date().toISOString().split('T')[0]}`,
        valuation_result: valuation,
        status: 'completed',
      })
      .select()
      .single();

    if (dealError) {
      console.error('Error saving deal:', dealError);
      // Continue even if saving fails
    }

    res.status(200).json({
      success: true,
      message: 'Valuation analysis completed',
      valuation,
      deal_id: deal?.id,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Valuation analysis error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to analyze property valuation'
      });
    }
  }
};
