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
 * Create property manually (no document required)
 * POST /api/properties
 */
export const createProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const data = req.body;
    const mappedPropertyType = data.property_type
      ? mapPropertyTypeToDatabase(data.property_type)
      : 'other';

    const { data: property, error: createError } = await supabaseAdmin
      .from('properties')
      .insert({
        created_by: req.user.id,
        address: data.address,
        city: data.city,
        state: data.state || 'CA',
        zip_code: data.zip_code,
        apn: data.apn,
        property_type: mappedPropertyType,
        subtype: data.subtype,
        building_size: data.building_size,
        lot_size: data.lot_size,
        year_built: data.year_built,
        stories: data.stories,
        units: data.units,
        price: data.price,
        price_per_sqft: data.price_per_sqft,
        cap_rate: data.cap_rate,
        noi: data.noi,
        gross_income: data.gross_income,
        operating_expenses: data.operating_expenses,
        occupancy_rate: data.occupancy_rate,
        market: data.market,
        submarket: data.submarket,
        zoning: data.zoning,
        parking_spaces: data.parking_spaces,
        status: data.status || 'prospect',
      })
      .select()
      .single();

    if (createError || !property) {
      console.error('Property creation error:', createError);
      throw new AppError(500, 'Failed to create property');
    }

    // Also create in master_properties so property appears in Property Database
    const masterPropertyType = (() => {
      const t = (data.property_type || '').toLowerCase();
      if (['warehouse', 'distribution_center', 'manufacturing', 'flex_space', 'cold_storage'].includes(t)) return 'industrial';
      if (t === 'office') return 'office';
      if (t === 'retail') return 'retail';
      if (t === 'multifamily') return 'multifamily';
      if (t === 'land') return 'land';
      if (t === 'residential') return 'residential';
      return 'industrial'; // default for CRE brokerage
    })();

    try {
      await supabaseAdmin
        .from('master_properties')
        .insert({
          address: data.address,
          city: data.city,
          state: data.state || 'CA',
          zip: data.zip_code,
          property_type: masterPropertyType,
          building_size: data.building_size ? Number(data.building_size) : null,
          lot_size_acres: data.lot_size ? Number(data.lot_size) : null,
          year_built: data.year_built ? Number(data.year_built) : null,
          number_of_floors: data.stories ? Number(data.stories) : null,
          number_of_units: data.units ? Number(data.units) : null,
          percent_leased: data.occupancy_rate ? Number(data.occupancy_rate) : null,
          parking_spaces: data.parking_spaces ? Number(data.parking_spaces) : null,
          zoning: data.zoning,
          market: data.market,
          submarket: data.submarket,
          apn: data.apn,
          source: 'manual',
          created_by: req.user!.id,
        });
    } catch (mpErr) {
      // Don't fail the response if master_properties insert fails (e.g., duplicate)
      console.error('master_properties mirror insert failed (non-fatal):', mpErr);
    }

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
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

    // Convert lot_size to SF if provided in acres
    let lotSizeValue = propertyData.lot_size;
    if (lotSizeValue && propertyData.lot_size_unit === 'acres') {
      lotSizeValue = Math.round(lotSizeValue * 43560); // Convert acres to SF
    }

    // Try to find matching master_property for direct link
    let masterPropertyId: string | null = null;
    if (propertyData.address) {
      let lookupQuery = supabaseAdmin
        .from('master_properties')
        .select('id')
        .ilike('address', propertyData.address.trim())
        .eq('is_deleted', false);

      if (propertyData.city) {
        lookupQuery = lookupQuery.ilike('city', propertyData.city.trim());
      }

      const { data: matchedMaster } = await lookupQuery.limit(1).maybeSingle();
      if (matchedMaster) {
        masterPropertyId = matchedMaster.id;
      }
    }

    // Create property record
    const { data: property, error: createError } = await supabaseAdmin
      .from('properties')
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
        lot_size: lotSizeValue,
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
          lot_size_unit: propertyData.lot_size_unit || 'sf',
          ...(masterPropertyId && { master_property_id: masterPropertyId }),
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
 * Create a My Deals property from a master_properties record
 * POST /api/properties/from-master/:masterPropertyId
 */
export const createPropertyFromMaster = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { masterPropertyId } = req.params;

    // Fetch the master property
    const { data: mp, error: fetchError } = await supabaseAdmin
      .from('master_properties')
      .select('*')
      .eq('id', masterPropertyId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !mp) {
      throw new AppError(404, 'Property not found in database');
    }

    // Map master_properties property_type to properties table enum
    const mappedType = mapPropertyTypeToDatabase(mp.property_type);

    // Fetch latest sale transaction for pricing data
    const { data: latestSale } = await supabaseAdmin
      .from('transactions')
      .select('sale_price, price_per_sf, cap_rate, noi')
      .eq('property_id', masterPropertyId)
      .eq('transaction_type', 'sale')
      .order('transaction_date', { ascending: false })
      .limit(1)
      .single();

    const { data: property, error: createError } = await supabaseAdmin
      .from('properties')
      .insert({
        created_by: req.user.id,
        address: mp.address,
        city: mp.city,
        state: mp.state || 'CA',
        zip_code: mp.zip,
        apn: mp.apn,
        property_type: mappedType,
        subtype: mp.property_subtype,
        building_size: mp.building_size,
        lot_size: mp.land_area_sf || mp.lot_size_acres,
        year_built: mp.year_built,
        stories: mp.number_of_floors,
        units: mp.number_of_units,
        price: latestSale?.sale_price || null,
        price_per_sqft: latestSale?.price_per_sf || null,
        cap_rate: latestSale?.cap_rate || null,
        noi: latestSale?.noi || null,
        occupancy_rate: mp.percent_leased,
        market: mp.market,
        submarket: mp.submarket,
        zoning: mp.zoning,
        parking_spaces: mp.parking_spaces,
        status: 'prospect',
        additional_data: {
          master_property_id: masterPropertyId,
        },
      })
      .select()
      .single();

    if (createError || !property) {
      console.error('Property creation from master error:', createError);
      throw new AppError(500, 'Failed to create property in My Deals');
    }

    res.status(201).json({
      success: true,
      message: 'Property added to My Deals',
      property,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Create property from master error:', error);
      res.status(500).json({ success: false, error: 'Failed to add property to My Deals' });
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
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingProperty) {
      throw new AppError(404, 'Property not found');
    }

    // Ownership check skipped — open access mode

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
      .from('properties')
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

    // Get property with related documents
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('*, documents(id, file_name, document_type, extraction_status, uploaded_at)')
      .eq('id', id)
      .single();

    if (propertyError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Ownership check skipped — open access mode

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
      .from('properties')
      .select('*, documents(id, file_name, document_type)', { count: 'exact' })
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

    // Attach primary photo URL to each property
    if (properties && properties.length > 0) {
      const propertyIds = properties.map((p: any) => p.id);

      // Fetch all photos for these properties (sorted so primary comes first, then by sort_order)
      const { data: allPhotos } = await supabaseAdmin
        .from('property_photos')
        .select('property_id, file_path, is_primary')
        .in('property_id', propertyIds)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true });

      if (allPhotos && allPhotos.length > 0) {
        // Pick the best photo per property: primary first, otherwise first by sort_order
        const photoMap = new Map<string, string>();
        for (const photo of allPhotos) {
          if (!photoMap.has(photo.property_id)) {
            photoMap.set(photo.property_id, photo.file_path);
          }
        }
        for (const prop of properties as any[]) {
          const filePath = photoMap.get(prop.id);
          if (filePath) {
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('property-photos')
              .getPublicUrl(filePath);
            prop.primary_photo_url = publicUrl;
          }
        }
      }
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
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Ownership check skipped — open access mode

    // Soft delete: mark as archived
    const { error: deleteError } = await supabaseAdmin
      .from('properties')
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
      .from('properties')
      .select('created_by')
      .eq('id', id)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Ownership check skipped — open access mode

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
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Check access
    // Ownership check skipped — open access mode

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

/**
 * Get transaction history for a property by matching to master_properties
 * GET /api/properties/:id/transactions
 *
 * Strategy:
 * 1. Check additional_data.master_property_id for a direct link
 * 2. Fall back to flexible address matching (ilike with wildcards)
 */
export const getPropertyTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get the property including additional_data for direct link
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('address, city, state, additional_data')
      .eq('id', id)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    let masterIds: string[] = [];

    // Strategy 1: Direct link via additional_data.master_property_id
    const directMasterId = (property.additional_data as any)?.master_property_id;
    if (directMasterId) {
      masterIds.push(directMasterId);
    }

    // Strategy 2: Address matching (flexible with wildcards and city)
    if (property.address) {
      const addr = property.address.trim();

      // Try exact ilike match first
      let lookupQuery = supabaseAdmin
        .from('master_properties')
        .select('id')
        .ilike('address', addr)
        .eq('is_deleted', false);

      const { data: exactMatches } = await lookupQuery;

      if (exactMatches && exactMatches.length > 0) {
        for (const mp of exactMatches) {
          if (!masterIds.includes(mp.id)) masterIds.push(mp.id);
        }
      } else {
        // Try fuzzy match: wildcard around address, filtered by city
        let fuzzyQuery = supabaseAdmin
          .from('master_properties')
          .select('id')
          .ilike('address', `%${addr}%`)
          .eq('is_deleted', false);

        if (property.city) {
          fuzzyQuery = fuzzyQuery.ilike('city', property.city.trim());
        }

        const { data: fuzzyMatches } = await fuzzyQuery;
        if (fuzzyMatches) {
          for (const mp of fuzzyMatches) {
            if (!masterIds.includes(mp.id)) masterIds.push(mp.id);
          }
        }
      }
    }

    if (masterIds.length === 0) {
      res.status(200).json({ success: true, transactions: [] });
      return;
    }

    // Fetch all transactions for matching master properties
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .in('property_id', masterIds)
      .order('transaction_date', { ascending: false });

    if (txError) {
      throw new AppError(500, 'Failed to fetch transactions');
    }

    res.status(200).json({
      success: true,
      transactions: transactions || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Get property transactions error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
  }
};
