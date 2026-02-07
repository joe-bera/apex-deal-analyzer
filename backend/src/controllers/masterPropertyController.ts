import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/supabase';

// Helper to normalize addresses for matching
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.$/g, '')
    .replace(/ street| st\.?| avenue| ave\.?| boulevard| blvd\.?| drive| dr\.?| road| rd\.?| lane| ln\.?| court| ct\.?| place| pl\.?| way/gi, '')
    .replace(/ north| south| east| west| n\.?| s\.?| e\.?| w\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Map property type strings to enum values
function mapPropertyType(type: string | undefined): string | null {
  if (!type) return null;

  const normalized = type.toLowerCase().trim();

  const typeMap: Record<string, string> = {
    'industrial': 'industrial',
    'warehouse': 'industrial',
    'distribution': 'industrial',
    'manufacturing': 'industrial',
    'flex': 'industrial',
    'retail': 'retail',
    'shopping': 'retail',
    'strip center': 'retail',
    'office': 'office',
    'multifamily': 'multifamily',
    'apartment': 'multifamily',
    'residential': 'residential',
    'land': 'land',
    'special purpose': 'special_purpose',
    'hospitality': 'special_purpose',
    'hotel': 'special_purpose',
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return null;
}

// Get all master properties
export const getMasterProperties = async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, city, state, property_type, search } = req.query;

    let query = supabase
      .from('property_with_latest_transaction')
      .select('*', { count: 'exact' });

    // Apply filters
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    if (state) {
      query = query.eq('state', state);
    }
    if (property_type) {
      query = query.eq('property_type', property_type);
    }
    if (search) {
      query = query.or(`address.ilike.%${search}%,property_name.ilike.%${search}%,city.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      properties: data || [],
      pagination: {
        total: count || 0,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching master properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties',
    });
  }
};

// Get single master property with transactions
export const getMasterProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get property
    const { data: property, error: propError } = await supabase
      .from('master_properties')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (propError) throw propError;
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
      });
    }

    // Get transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('property_id', id)
      .order('transaction_date', { ascending: false });

    if (txError) throw txError;

    return res.json({
      success: true,
      property,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('Error fetching master property:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch property',
    });
  }
};

// Valid columns in master_properties table (expanded list)
const VALID_PROPERTY_COLUMNS = new Set([
  // Core identification
  'address', 'city', 'state', 'zip', 'county', 'property_name', 'property_type',
  'building_park', 'costar_id', 'crexi_id', 'apn', 'unit_suite',

  // Classification
  'property_subtype', 'building_class', 'building_status', 'zoning',

  // Location
  'latitude', 'longitude', 'submarket', 'market', 'cross_street', 'opportunity_zone',

  // Size
  'building_size', 'land_area_sf', 'lot_size_acres', 'typical_floor_size',
  'number_of_floors', 'number_of_units', 'number_of_buildings', 'number_of_addresses',

  // Building details
  'year_built', 'month_built', 'year_renovated', 'month_renovated', 'construction_material',

  // Industrial
  'clear_height_ft', 'dock_doors', 'grade_doors', 'rail_served', 'column_spacing',
  'sprinkler_type', 'number_of_cranes', 'power', 'office_percentage',

  // Office
  'office_space', 'number_of_elevators',

  // Parking
  'parking_spaces', 'parking_ratio',

  // Leasing
  'percent_leased', 'vacancy_percent', 'days_on_market',

  // Rent
  'rent_per_sf', 'avg_weighted_rent',

  // Owner
  'owner_name', 'owner_contact', 'owner_phone', 'owner_address',
  'mailing_city', 'mailing_state', 'mailing_zip', 'mailing_care_of',
  'parent_company', 'fund_name',

  // Property manager
  'property_manager_name', 'property_manager_phone',

  // Leasing company
  'leasing_company_name', 'leasing_company_contact', 'leasing_company_phone',

  // Developer/Architect
  'developer_name', 'architect_name',

  // Tax
  'improvement_value', 'land_value', 'total_parcel_value', 'parcel_value_type',
  'tax_year', 'annual_tax_bill',

  // Utilities
  'water', 'sewer', 'gas',

  // Amenities
  'amenities', 'features',

  // Meta
  'source', 'created_by', 'raw_import_data',

  // Transaction fields (handled separately but accepted in mapping)
  'sale_price', 'price_per_sf', 'price_per_acre', 'cap_rate', 'asking_cap_rate', 'noi',
  'transaction_date', 'buyer_name', 'seller_name', 'for_sale_status',
  'lease_rate', 'lease_type', 'lease_term', 'lease_expiration_date', 'tenant_name',
  'lender', 'loan_amount', 'loan_type', 'interest_rate', 'maturity_date',
]);

// Transaction-specific fields that should be stored in transactions table, not properties
const TRANSACTION_FIELDS = new Set([
  'sale_price', 'price_per_sf', 'price_per_acre', 'cap_rate', 'asking_cap_rate', 'noi',
  'transaction_date', 'buyer_name', 'seller_name', 'for_sale_status',
  'lease_rate', 'lease_type', 'lease_term', 'lease_expiration_date', 'tenant_name',
  'lender', 'loan_amount', 'loan_type', 'interest_rate', 'maturity_date',
]);

// Bulk import properties
export const importProperties = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { source, columnMapping, rows } = req.body;

    console.log('[Import] Starting import...');
    console.log('[Import] User ID:', userId);
    console.log('[Import] Source:', source);
    console.log('[Import] Column mapping:', JSON.stringify(columnMapping));
    console.log('[Import] Rows count:', rows?.length);

    // Filter out invalid column mappings
    const validMapping: Record<string, string> = {};
    const skippedColumns: string[] = [];
    for (const [csvCol, dbField] of Object.entries(columnMapping)) {
      if (dbField && VALID_PROPERTY_COLUMNS.has(dbField as string)) {
        validMapping[csvCol] = dbField as string;
      } else if (dbField) {
        skippedColumns.push(`${csvCol} -> ${dbField}`);
      }
    }
    if (skippedColumns.length > 0) {
      console.log('[Import] Skipped invalid column mappings:', skippedColumns.join(', '));
    }
    console.log('[Import] Valid mappings:', Object.keys(validMapping).length);

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log('[Import] ERROR: No data rows provided');
      return res.status(400).json({
        success: false,
        error: 'No data rows provided',
      });
    }

    // Check if address field is mapped (value is 'address', not key)
    const hasAddressMapping = Object.values(validMapping).includes('address');
    console.log('[Import] Has address mapping:', hasAddressMapping);
    if (!hasAddressMapping) {
      console.log('[Import] ERROR: Address field mapping is required');
      return res.status(400).json({
        success: false,
        error: 'Address field mapping is required',
      });
    }

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        filename: `import_${Date.now()}`,
        source: source || 'other',
        total_rows: rows.length,
        imported_rows: 0,
        skipped_rows: 0,
        error_rows: 0,
        column_mapping: columnMapping,
        created_by: userId,
      })
      .select()
      .single();

    if (batchError) {
      console.error('[Import] Error creating batch:', batchError);
    } else {
      console.log('[Import] Batch created successfully');
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: { row: number; error: string }[] = [];
    const propertiesCreated: string[] = [];
    const propertiesUpdated: string[] = [];
    const transactionsCreated: string[] = [];

    // Process each row
    console.log('[Import] Starting to process rows...');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Log progress every 50 rows
      if (i % 50 === 0) {
        console.log(`[Import] Processing row ${i + 1}/${rows.length}`);
      }

      try {
        // Build property object from mapping
        const propertyData: Record<string, any> = {
          source: source || 'other',
          created_by: userId,
          raw_import_data: row,
        };
        const transactionData: Record<string, any> = {};

        // Map fields from CSV to database (using validated mapping)
        for (const [csvCol, dbField] of Object.entries(validMapping)) {
          if (dbField && row[csvCol] !== undefined && row[csvCol] !== '') {
            let value = row[csvCol];

            // Handle INTEGER fields (must be whole numbers)
            const integerFields = ['building_size', 'land_area_sf', 'year_built', 'year_renovated',
                 'number_of_floors', 'number_of_units', 'dock_doors', 'grade_doors',
                 'parking_spaces', 'number_of_buildings', 'number_of_addresses', 'days_on_market'];
            // Handle DECIMAL/FLOAT fields (can have decimals)
            const decimalFields = ['lot_size_acres', 'clear_height_ft', 'parking_ratio',
                 'percent_leased', 'office_percentage', 'sale_price', 'price_per_sf', 'price_per_acre',
                 'cap_rate', 'asking_cap_rate', 'noi', 'latitude', 'longitude', 'rent_per_sf',
                 'improvement_value', 'land_value', 'total_parcel_value', 'annual_tax_bill',
                 'loan_amount', 'interest_rate'];

            if (integerFields.includes(dbField)) {
              const parsed = parseFloat(String(value).replace(/[$,%,]/g, ''));
              value = isNaN(parsed) ? null : Math.round(parsed);
            } else if (decimalFields.includes(dbField)) {
              value = parseFloat(String(value).replace(/[$,%,]/g, ''));
              if (isNaN(value)) value = null;
            }

            // Handle property type
            if (dbField === 'property_type') {
              value = mapPropertyType(value);
            }

            // Handle boolean fields
            if (dbField === 'rail_served' || dbField === 'opportunity_zone') {
              value = ['yes', 'true', '1', 'y'].includes(String(value).toLowerCase());
            }

            // Handle state normalization (2-letter code)
            if (dbField === 'state' && value) {
              const stateMap: Record<string, string> = {
                'CALIFORNIA': 'CA', 'ARIZONA': 'AZ', 'NEVADA': 'NV', 'TEXAS': 'TX',
                'OREGON': 'OR', 'WASHINGTON': 'WA', 'COLORADO': 'CO', 'UTAH': 'UT', 'NEW MEXICO': 'NM',
              };
              const trimmed = String(value).trim().toUpperCase();
              if (trimmed.length > 2 && stateMap[trimmed]) {
                value = stateMap[trimmed];
              } else if (trimmed.length === 2) {
                value = trimmed;
              }
            }

            if (value !== null && value !== undefined) {
              // Separate transaction fields from property fields
              if (TRANSACTION_FIELDS.has(dbField as string)) {
                transactionData[dbField as string] = value;
              } else {
                propertyData[dbField as string] = value;
              }
            }
          }
        }

        // Validate address - reject Location Type values that got mapped incorrectly
        const invalidAddressValues = ['suburban', 'urban', 'cbd', 'rural'];
        if (!propertyData.address || invalidAddressValues.includes(String(propertyData.address).toLowerCase().trim())) {
          if (i < 5) console.log(`[Import] Row ${i + 1}: Skipped - invalid or missing address: "${propertyData.address}"`);
          skipped++;
          continue;
        }

        // Skip if missing city or state
        if (!propertyData.city || !propertyData.state) {
          if (i < 5) console.log(`[Import] Row ${i + 1}: Skipped - missing city or state`);
          skipped++;
          continue;
        }

        if (i < 5) console.log(`[Import] Row ${i + 1}: Address = "${propertyData.address}", City = "${propertyData.city}", State = "${propertyData.state}"`);

        // Normalize address for duplicate detection
        const normalizedAddr = normalizeAddress(propertyData.address);
        const normalizedCity = propertyData.city.toLowerCase().trim();
        const normalizedState = propertyData.state.toUpperCase().trim();

        // Check for existing property by normalized address + city + state
        const { data: existing } = await supabase
          .from('master_properties')
          .select('id')
          .eq('address_normalized', normalizedAddr)
          .ilike('city', normalizedCity)
          .eq('state', normalizedState)
          .eq('is_deleted', false)
          .limit(1);

        let propertyId: string;

        if (existing && existing.length > 0) {
          // Property exists - UPDATE it with new data
          propertyId = existing[0].id;

          // Remove fields that shouldn't be updated
          const updateData = { ...propertyData };
          delete updateData.created_by;
          delete updateData.raw_import_data;
          updateData.updated_at = new Date().toISOString();

          const { error: updateError } = await supabase
            .from('master_properties')
            .update(updateData)
            .eq('id', propertyId);

          if (updateError) {
            if (i < 5) console.log(`[Import] Row ${i + 1}: Update error - ${updateError.message}`);
            throw new Error(updateError.message);
          }

          propertiesUpdated.push(propertyId);
          updated++;
          if (i < 5) console.log(`[Import] Row ${i + 1}: Updated property ${propertyId}`);
        } else {
          // Create new property
          const { data: newProperty, error: insertError } = await supabase
            .from('master_properties')
            .insert(propertyData)
            .select()
            .single();

          if (insertError) {
            if (i < 5) console.log(`[Import] Row ${i + 1}: Insert error - ${insertError.message}`);
            throw new Error(insertError.message);
          }

          propertyId = newProperty.id;
          propertiesCreated.push(propertyId);
          inserted++;
          if (i < 5) console.log(`[Import] Row ${i + 1}: Created property ${propertyId}`);
        }

        // If there's transaction data (sale price, cap rate, or NOI), create a transaction
        if (transactionData.sale_price || transactionData.cap_rate || transactionData.noi) {
          const txRecord = {
            property_id: propertyId,
            transaction_type: transactionData.lease_rate ? 'lease' : 'sale',
            sale_price: transactionData.sale_price || null,
            price_per_sf: transactionData.price_per_sf || null,
            cap_rate: transactionData.cap_rate || transactionData.asking_cap_rate || null,
            noi: transactionData.noi || null,
            transaction_date: transactionData.transaction_date || null,
            buyer_name: transactionData.buyer_name || null,
            seller_name: transactionData.seller_name || null,
            source: source || 'other',
            created_by: userId,
            raw_import_data: row,
          };

          const { data: newTx, error: txError } = await supabase
            .from('transactions')
            .insert(txRecord)
            .select()
            .single();

          if (!txError && newTx) {
            transactionsCreated.push(newTx.id);
          }
        }
      } catch (err) {
        errors++;
        errorDetails.push({
          row: i + 1,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    console.log(`[Import] Processing complete: inserted=${inserted}, updated=${updated}, skipped=${skipped}, errors=${errors}`);

    // Update batch record
    if (batch) {
      await supabase
        .from('import_batches')
        .update({
          imported_rows: inserted + updated,
          skipped_rows: skipped,
          error_rows: errors,
          errors: errorDetails,
          completed_at: new Date().toISOString(),
        })
        .eq('id', batch.id);
    }

    console.log('[Import] Sending response...');
    return res.json({
      success: true,
      batch_id: batch?.id,
      imported: inserted,
      updated,
      skipped,
      errors,
      properties_created: propertiesCreated,
      properties_updated: propertiesUpdated,
      transactions_created: transactionsCreated,
      error_details: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('Error importing properties:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed',
    });
  }
};

// Search for potential duplicates
export const searchDuplicates = async (req: Request, res: Response) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required',
      });
    }

    const normalizedAddr = normalizeAddress(String(address));

    const { data, error } = await supabase
      .from('master_properties')
      .select('id, address, city, state, property_type, building_size')
      .eq('address_normalized', normalizedAddr)
      .eq('is_deleted', false)
      .limit(5);

    if (error) throw error;

    return res.json({
      success: true,
      matches: data || [],
    });
  } catch (error) {
    console.error('Error searching duplicates:', error);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
    });
  }
};

// Get properties needing verification (older than 1 year)
export const getVerificationQueue = async (_req: Request, res: Response) => {
  try {
    const { data, error, count } = await supabase
      .from('master_properties')
      .select('id, address, city, state, verified_at, verification_reminder_at', { count: 'exact' })
      .eq('is_deleted', false)
      .or(`verified_at.is.null,verification_reminder_at.lt.${new Date().toISOString()}`)
      .order('verification_reminder_at', { ascending: true, nullsFirst: true })
      .limit(50);

    if (error) throw error;

    return res.json({
      success: true,
      properties: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('Error fetching verification queue:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch verification queue',
    });
  }
};

// Mark property as verified
export const verifyProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('master_properties')
      .update({
        verified_at: new Date().toISOString(),
        verification_reminder_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      property: data,
    });
  } catch (error) {
    console.error('Error verifying property:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify property',
    });
  }
};
