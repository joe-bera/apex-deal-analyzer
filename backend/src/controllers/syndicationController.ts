import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * List all active syndication platforms
 * GET /api/syndication/platforms
 */
export const listPlatforms = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data, error } = await supabaseAdmin
      .from('syndication_platforms')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (error) {
      console.error('Error listing platforms:', error);
      throw new AppError(500, 'Failed to list platforms');
    }

    res.status(200).json({ success: true, platforms: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * List all syndication listings with joins
 * GET /api/syndication
 */
export const listSyndications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { platform_id, status, listing_site_id } = req.query;

    let query = supabaseAdmin
      .from('syndication_listings')
      .select(`
        *,
        platform:syndication_platforms(id, name, display_name, integration_type, website_url),
        listing_site:listing_sites(id, slug, is_published, master_property_id, custom_headline,
          master_properties(id, address, city, state, zip, property_type, building_size)
        )
      `)
      .order('created_at', { ascending: false });

    if (platform_id) query = query.eq('platform_id', platform_id);
    if (status) query = query.eq('status', status);
    if (listing_site_id) query = query.eq('listing_site_id', listing_site_id);

    const { data, error } = await query;

    if (error) {
      console.error('Error listing syndications:', error);
      throw new AppError(500, 'Failed to list syndications');
    }

    res.status(200).json({ success: true, syndications: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get single syndication with activity log
 * GET /api/syndication/:id
 */
export const getSyndication = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const [syndicationResult, activityResult] = await Promise.all([
      supabaseAdmin
        .from('syndication_listings')
        .select(`
          *,
          platform:syndication_platforms(id, name, display_name, integration_type, website_url, field_mapping),
          listing_site:listing_sites(id, slug, is_published, master_property_id, custom_headline,
            master_properties(id, address, city, state, zip, property_type, building_size)
          )
        `)
        .eq('id', id)
        .single(),
      supabaseAdmin
        .from('syndication_activity_log')
        .select('*')
        .eq('syndication_listing_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (syndicationResult.error || !syndicationResult.data) {
      throw new AppError(404, 'Syndication not found');
    }

    res.status(200).json({
      success: true,
      syndication: syndicationResult.data,
      activity: activityResult.data || [],
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
 * Create a draft syndication
 * POST /api/syndication
 */
export const createSyndication = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { listing_site_id, platform_id } = req.body;

    if (!listing_site_id || !platform_id) {
      throw new AppError(400, 'listing_site_id and platform_id are required');
    }

    const { data, error } = await supabaseAdmin
      .from('syndication_listings')
      .insert({
        listing_site_id,
        platform_id,
        status: 'draft',
        created_by: req.user.id,
      })
      .select(`
        *,
        platform:syndication_platforms(id, name, display_name, integration_type),
        listing_site:listing_sites(id, slug, is_published, master_property_id,
          master_properties(id, address, city, state, zip)
        )
      `)
      .single();

    if (error || !data) {
      console.error('Error creating syndication:', error);
      throw new AppError(500, 'Failed to create syndication');
    }

    // Log activity
    await supabaseAdmin
      .from('syndication_activity_log')
      .insert({
        syndication_listing_id: data.id,
        action: 'created',
        details: { created_by: req.user.id },
      });

    res.status(201).json({ success: true, syndication: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Publish a syndication
 * POST /api/syndication/:id/publish
 */
export const publishSyndication = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('syndication_listings')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError(404, 'Syndication not found');
    }

    await supabaseAdmin
      .from('syndication_activity_log')
      .insert({
        syndication_listing_id: id,
        action: 'published',
        details: { published_by: req.user.id },
      });

    res.status(200).json({ success: true, syndication: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Sync a syndication
 * POST /api/syndication/:id/sync
 */
export const syncSyndication = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('syndication_listings')
      .update({
        status: 'synced',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError(404, 'Syndication not found');
    }

    await supabaseAdmin
      .from('syndication_activity_log')
      .insert({
        syndication_listing_id: id,
        action: 'synced',
        details: { synced_by: req.user.id },
      });

    res.status(200).json({ success: true, syndication: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delist a syndication
 * POST /api/syndication/:id/delist
 */
export const delistSyndication = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('syndication_listings')
      .update({
        status: 'delisted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError(404, 'Syndication not found');
    }

    await supabaseAdmin
      .from('syndication_activity_log')
      .insert({
        syndication_listing_id: id,
        action: 'delisted',
        details: { delisted_by: req.user.id },
      });

    res.status(200).json({ success: true, syndication: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete a syndication
 * DELETE /api/syndication/:id
 */
export const deleteSyndication = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('syndication_listings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting syndication:', error);
      throw new AppError(500, 'Failed to delete syndication');
    }

    res.status(200).json({ success: true, message: 'Syndication deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Generate CSV or JSON export for manual upload to a platform
 * POST /api/syndication/:id/export
 */
export const generateExport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;
    const { format = 'csv' } = req.body;

    // Fetch syndication with platform field mapping and property data
    const { data: syndication, error } = await supabaseAdmin
      .from('syndication_listings')
      .select(`
        *,
        platform:syndication_platforms(id, name, display_name, field_mapping),
        listing_site:listing_sites(id, slug, custom_headline, custom_description, master_property_id,
          master_properties(
            id, address, city, state, zip, property_type, property_subtype,
            building_size, lot_size_acres, year_built, clear_height_ft,
            dock_doors, grade_doors, owner_name, notes
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !syndication) {
      throw new AppError(404, 'Syndication not found');
    }

    const platform = syndication.platform as any;
    const listingSite = syndication.listing_site as any;
    const property = listingSite?.master_properties;

    if (!property) {
      throw new AppError(400, 'No property data found for this listing');
    }

    // Get latest transaction for price data
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('sale_price, asking_price, price_per_sf, cap_rate, noi')
      .eq('property_id', property.id)
      .order('transaction_date', { ascending: false })
      .limit(1);

    const tx = transactions?.[0];

    // Build source data from property + transaction
    const sourceData: Record<string, any> = {
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      building_size: property.building_size,
      lot_size_acres: property.lot_size_acres,
      property_type: property.property_type,
      property_subtype: property.property_subtype,
      year_built: property.year_built,
      clear_height_ft: property.clear_height_ft,
      dock_doors: property.dock_doors,
      grade_doors: property.grade_doors,
      price: tx?.asking_price || tx?.sale_price,
      cap_rate: tx?.cap_rate,
      noi: tx?.noi,
      description: listingSite.custom_description || '',
    };

    const fieldMapping = (platform.field_mapping || {}) as Record<string, string>;

    // Map our fields to platform fields
    const mappedData: Record<string, any> = {};
    for (const [ourField, platformField] of Object.entries(fieldMapping)) {
      if (sourceData[ourField] !== undefined && sourceData[ourField] !== null) {
        mappedData[platformField] = sourceData[ourField];
      }
    }

    let exportData: string;
    const platformName = platform.name || 'export';

    if (format === 'json') {
      exportData = JSON.stringify(mappedData, null, 2);
    } else {
      // CSV format
      const headers = Object.keys(mappedData);
      const values = Object.values(mappedData).map(v => {
        const str = String(v ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      });
      exportData = headers.join(',') + '\n' + values.join(',');
    }

    const fileName = `${platformName}_${property.address?.replace(/\s+/g, '_') || 'listing'}_${Date.now()}.${format}`;

    // Log export activity
    await supabaseAdmin
      .from('syndication_activity_log')
      .insert({
        syndication_listing_id: id,
        action: 'exported',
        details: { format, exported_by: req.user.id },
      });

    res.status(200).json({
      success: true,
      export: {
        format,
        data: exportData,
        file_name: fileName,
        platform_name: platform.display_name,
      },
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
 * Get activity log for a syndication
 * GET /api/syndication/:id/activity
 */
export const getSyndicationActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('syndication_activity_log')
      .select('*')
      .eq('syndication_listing_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activity:', error);
      throw new AppError(500, 'Failed to fetch activity');
    }

    res.status(200).json({ success: true, activity: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Bulk publish a listing to multiple platforms at once
 * POST /api/syndication/bulk-publish
 */
export const bulkPublish = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { listing_site_id, platform_ids } = req.body;

    if (!listing_site_id || !Array.isArray(platform_ids) || platform_ids.length === 0) {
      throw new AppError(400, 'listing_site_id and platform_ids[] are required');
    }

    const rows = platform_ids.map((platform_id: string) => ({
      listing_site_id,
      platform_id,
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: req.user.id,
    }));

    const { data, error } = await supabaseAdmin
      .from('syndication_listings')
      .insert(rows)
      .select(`
        *,
        platform:syndication_platforms(id, name, display_name, integration_type)
      `);

    if (error) {
      console.error('Error bulk publishing:', error);
      throw new AppError(500, 'Failed to bulk publish');
    }

    // Log activity for each
    if (data && data.length > 0) {
      const activityRows = data.map((s: any) => ({
        syndication_listing_id: s.id,
        action: 'published',
        details: { published_by: req.user.id, bulk: true },
      }));
      await supabaseAdmin.from('syndication_activity_log').insert(activityRows);
    }

    res.status(201).json({ success: true, syndications: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
