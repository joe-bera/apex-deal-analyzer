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

// Bulk import properties
export const importProperties = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { source, columnMapping, rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data rows provided',
      });
    }

    // Check if address field is mapped (value is 'address', not key)
    const hasAddressMapping = columnMapping && Object.values(columnMapping).includes('address');
    if (!hasAddressMapping) {
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
      console.error('Error creating batch:', batchError);
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: { row: number; error: string }[] = [];
    const propertiesCreated: string[] = [];
    const transactionsCreated: string[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Build property object from mapping
        const propertyData: Record<string, any> = {
          source: source || 'other',
          created_by: userId,
          raw_import_data: row,
        };

        // Map fields from CSV to database
        for (const [csvCol, dbField] of Object.entries(columnMapping)) {
          if (dbField && row[csvCol] !== undefined && row[csvCol] !== '') {
            let value = row[csvCol];

            // Handle numeric fields
            if (['building_size', 'land_area_sf', 'lot_size_acres', 'year_built', 'year_renovated',
                 'number_of_floors', 'number_of_units', 'clear_height_ft', 'dock_doors', 'grade_doors',
                 'parking_spaces', 'parking_ratio', 'percent_leased', 'office_percentage',
                 'sale_price', 'price_per_sf', 'cap_rate', 'noi'].includes(dbField as string)) {
              value = parseFloat(String(value).replace(/[$,%]/g, ''));
              if (isNaN(value)) value = null;
            }

            // Handle property type
            if (dbField === 'property_type') {
              value = mapPropertyType(value);
            }

            // Handle boolean fields
            if (dbField === 'rail_served') {
              value = ['yes', 'true', '1', 'y'].includes(String(value).toLowerCase());
            }

            if (value !== null && value !== undefined) {
              propertyData[dbField as string] = value;
            }
          }
        }

        // Skip if no address
        if (!propertyData.address) {
          skipped++;
          continue;
        }

        // Normalize address for duplicate detection
        const normalizedAddr = normalizeAddress(propertyData.address);

        // Check for existing property
        const { data: existing } = await supabase
          .from('master_properties')
          .select('id')
          .eq('address_normalized', normalizedAddr)
          .eq('is_deleted', false)
          .limit(1);

        let propertyId: string;

        if (existing && existing.length > 0) {
          // Property exists - use existing ID
          propertyId = existing[0].id;
          skipped++; // Count as skipped since we're not creating new
        } else {
          // Create new property
          // Remove transaction fields from property data
          const transactionFields = ['sale_price', 'price_per_sf', 'cap_rate', 'noi',
                                      'transaction_date', 'buyer_name', 'seller_name'];
          const cleanPropertyData = { ...propertyData };
          transactionFields.forEach(f => delete cleanPropertyData[f]);

          const { data: newProperty, error: insertError } = await supabase
            .from('master_properties')
            .insert(cleanPropertyData)
            .select()
            .single();

          if (insertError) {
            throw new Error(insertError.message);
          }

          propertyId = newProperty.id;
          propertiesCreated.push(propertyId);
          imported++;
        }

        // If there's transaction data, create a transaction
        if (propertyData.sale_price || propertyData.cap_rate || propertyData.noi) {
          const transactionData = {
            property_id: propertyId,
            transaction_type: 'sale',
            sale_price: propertyData.sale_price || null,
            price_per_sf: propertyData.price_per_sf || null,
            cap_rate: propertyData.cap_rate || null,
            noi: propertyData.noi || null,
            transaction_date: propertyData.transaction_date || null,
            buyer_name: propertyData.buyer_name || null,
            seller_name: propertyData.seller_name || null,
            source: source || 'other',
            created_by: userId,
            raw_import_data: row,
          };

          const { data: newTx, error: txError } = await supabase
            .from('transactions')
            .insert(transactionData)
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

    // Update batch record
    if (batch) {
      await supabase
        .from('import_batches')
        .update({
          imported_rows: imported,
          skipped_rows: skipped,
          error_rows: errors,
          errors: errorDetails,
          completed_at: new Date().toISOString(),
        })
        .eq('id', batch.id);
    }

    return res.json({
      success: true,
      batch_id: batch?.id,
      imported,
      skipped,
      errors,
      properties_created: propertiesCreated,
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
