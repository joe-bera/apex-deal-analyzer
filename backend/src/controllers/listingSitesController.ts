import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const VALID_TEMPLATE_STYLES = ['modern', 'classic', 'minimal'];

/**
 * Generate a URL-safe slug from a property address
 */
function generateSlug(address: string, city?: string, state?: string): string {
  const parts = [address, city, state].filter(Boolean).join(' ');
  return parts
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Create a listing site for a master property
 * POST /api/listing-sites
 */
export const createListingSite = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const {
      master_property_id,
      custom_headline,
      custom_description,
      template_style,
      lead_capture_email,
      virtual_tour_url,
      brochure_doc_id,
      om_doc_id,
    } = req.body;

    if (!master_property_id) {
      throw new AppError(400, 'master_property_id is required');
    }

    // Fetch property to generate slug
    const { data: property, error: propError } = await supabaseAdmin
      .from('master_properties')
      .select('address, city, state')
      .eq('id', master_property_id)
      .eq('is_deleted', false)
      .single();

    if (propError || !property) {
      throw new AppError(404, 'Property not found');
    }

    // Generate slug, ensure uniqueness
    let slug = generateSlug(property.address, property.city, property.state);
    const { data: existing } = await supabaseAdmin
      .from('listing_sites')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Validate template_style
    if (template_style && !VALID_TEMPLATE_STYLES.includes(template_style)) {
      throw new AppError(400, `template_style must be one of: ${VALID_TEMPLATE_STYLES.join(', ')}`);
    }

    const { data: site, error: insertError } = await supabaseAdmin
      .from('listing_sites')
      .insert({
        master_property_id,
        slug,
        custom_headline: custom_headline || null,
        custom_description: custom_description || null,
        template_style: template_style || 'modern',
        lead_capture_email: lead_capture_email || null,
        virtual_tour_url: virtual_tour_url || null,
        brochure_doc_id: brochure_doc_id || null,
        om_doc_id: om_doc_id || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (insertError || !site) {
      console.error('[ListingSites] Create error:', insertError);
      throw new AppError(500, 'Failed to create listing site');
    }

    res.status(201).json({
      success: true,
      message: 'Listing site created',
      listing_site: site,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[ListingSites] Create error:', error);
      res.status(500).json({ success: false, error: 'Failed to create listing site' });
    }
  }
};

/**
 * List user's listing sites
 * GET /api/listing-sites
 */
export const listListingSites = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: sites, error } = await supabaseAdmin
      .from('listing_sites')
      .select('*, master_properties(id, address, city, state, zip, property_type, building_size)')
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ListingSites] List error:', error);
      throw new AppError(500, 'Failed to list listing sites');
    }

    res.status(200).json({
      success: true,
      listing_sites: sites || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to list listing sites' });
    }
  }
};

/**
 * Get single listing site with property data
 * GET /api/listing-sites/:id
 */
export const getListingSite = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: site, error } = await supabaseAdmin
      .from('listing_sites')
      .select('*, master_properties(*)')
      .eq('id', id)
      .eq('created_by', req.user.id)
      .single();

    if (error || !site) {
      throw new AppError(404, 'Listing site not found');
    }

    res.status(200).json({
      success: true,
      listing_site: site,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch listing site' });
    }
  }
};

/**
 * Update listing site
 * PATCH /api/listing-sites/:id
 */
export const updateListingSite = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;
    const {
      custom_headline,
      custom_description,
      template_style,
      seo_title,
      seo_description,
      is_published,
      lead_capture_email,
      virtual_tour_url,
      brochure_doc_id,
      om_doc_id,
    } = req.body;

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('listing_sites')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Listing site not found');
    }

    if (existing.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to update this listing site');
    }

    if (template_style && !VALID_TEMPLATE_STYLES.includes(template_style)) {
      throw new AppError(400, `template_style must be one of: ${VALID_TEMPLATE_STYLES.join(', ')}`);
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (custom_headline !== undefined) updates.custom_headline = custom_headline;
    if (custom_description !== undefined) updates.custom_description = custom_description;
    if (template_style !== undefined) updates.template_style = template_style;
    if (seo_title !== undefined) updates.seo_title = seo_title;
    if (seo_description !== undefined) updates.seo_description = seo_description;
    if (is_published !== undefined) updates.is_published = is_published;
    if (lead_capture_email !== undefined) updates.lead_capture_email = lead_capture_email;
    if (virtual_tour_url !== undefined) updates.virtual_tour_url = virtual_tour_url;
    if (brochure_doc_id !== undefined) updates.brochure_doc_id = brochure_doc_id || null;
    if (om_doc_id !== undefined) updates.om_doc_id = om_doc_id || null;

    const { data: site, error: updateError } = await supabaseAdmin
      .from('listing_sites')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !site) {
      console.error('[ListingSites] Update error:', updateError);
      throw new AppError(500, 'Failed to update listing site');
    }

    res.status(200).json({
      success: true,
      message: 'Listing site updated',
      listing_site: site,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update listing site' });
    }
  }
};

/**
 * Delete listing site
 * DELETE /api/listing-sites/:id
 */
export const deleteListingSite = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('listing_sites')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Listing site not found');
    }

    if (existing.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to delete this listing site');
    }

    const { error: deleteError } = await supabaseAdmin
      .from('listing_sites')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new AppError(500, 'Failed to delete listing site');
    }

    res.status(200).json({
      success: true,
      message: 'Listing site deleted',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to delete listing site' });
    }
  }
};

/**
 * List leads for a listing site
 * GET /api/listing-sites/:id/leads
 */
export const getListingLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    // Verify ownership
    const { data: site, error: siteError } = await supabaseAdmin
      .from('listing_sites')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (siteError || !site) {
      throw new AppError(404, 'Listing site not found');
    }

    if (site.created_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to view these leads');
    }

    const { data: leads, error } = await supabaseAdmin
      .from('listing_leads')
      .select('*')
      .eq('listing_site_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(500, 'Failed to fetch leads');
    }

    res.status(200).json({
      success: true,
      leads: leads || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch leads' });
    }
  }
};
