import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const PHOTO_BUCKET = 'property-photos';

/**
 * Get a published listing by slug (public, no auth)
 * GET /api/public/listings/:slug
 */
export const getPublicListing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    // Fetch listing site
    const { data: site, error: siteError } = await supabaseAdmin
      .from('listing_sites')
      .select('*, master_properties(*)')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (siteError || !site) {
      throw new AppError(404, 'Listing not found');
    }

    const property = (site as any).master_properties;

    // Fetch latest transaction
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('property_id', site.master_property_id)
      .order('transaction_date', { ascending: false })
      .limit(1);

    const transaction = transactions?.[0] || null;

    // Fetch photos from property_photos (using master_property_id as property_id)
    const { data: photos } = await supabaseAdmin
      .from('property_photos')
      .select('*')
      .eq('property_id', site.master_property_id)
      .order('sort_order', { ascending: true });

    const photosWithUrls = (photos || []).map(photo => {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(photo.file_path);
      return { ...photo, url: publicUrl };
    });

    // Fetch linked documents (brochure/OM)
    const docIds = [site.brochure_doc_id, site.om_doc_id].filter(Boolean);
    let documents: any[] = [];
    if (docIds.length > 0) {
      const { data: docs } = await supabaseAdmin
        .from('generated_documents')
        .select('id, template_type, title, file_url')
        .in('id', docIds);
      documents = docs || [];
    }

    // Fetch broker/owner profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, company_name, company_phone, company_email, company_logo_url')
      .eq('id', site.created_by)
      .single();

    // Increment view count (fire and forget)
    supabaseAdmin
      .from('listing_sites')
      .update({ view_count: (site.view_count || 0) + 1 })
      .eq('id', site.id)
      .then(() => {});

    // Remove internal fields from site before sending
    const { master_properties: _mp, created_by: _cb, ...sitePublic } = site as any;

    res.status(200).json({
      success: true,
      listing: {
        ...sitePublic,
        property,
        transaction,
        photos: photosWithUrls,
        documents,
        broker: profile || null,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[PublicListing] Get error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch listing' });
    }
  }
};

/**
 * Submit a lead for a listing (public, no auth)
 * POST /api/public/listings/:slug/leads
 */
export const submitLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { name, email, phone, company, message } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      throw new AppError(400, 'Name is required');
    }
    if (!email || !email.trim()) {
      throw new AppError(400, 'Email is required');
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(400, 'Invalid email address');
    }

    // Fetch listing site (must be published)
    const { data: site, error: siteError } = await supabaseAdmin
      .from('listing_sites')
      .select('id, created_by, master_property_id, slug, lead_count')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (siteError || !site) {
      throw new AppError(404, 'Listing not found');
    }

    // Create lead record
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('listing_leads')
      .insert({
        listing_site_id: site.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        message: message?.trim() || null,
        source: 'listing_site',
      })
      .select()
      .single();

    if (leadError || !lead) {
      console.error('[PublicListing] Lead insert error:', leadError);
      throw new AppError(500, 'Failed to submit inquiry');
    }

    // Auto-create contact in CRM (best-effort)
    try {
      // Split name into first/last
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          contact_type: 'buyer',
          source: 'listing_site',
          tags: ['listing_lead'],
          notes: company ? `Company: ${company}` : null,
          created_by: site.created_by,
        })
        .select('id')
        .single();

      if (contact) {
        // Link contact to lead
        await supabaseAdmin
          .from('listing_leads')
          .update({ contact_id: contact.id })
          .eq('id', lead.id);

        // Create activity
        await supabaseAdmin
          .from('activities')
          .insert({
            activity_type: 'email',
            subject: `Listing inquiry from ${slug}`,
            description: message?.trim() || `New lead submitted via listing page for ${slug}`,
            contact_id: contact.id,
            activity_date: new Date().toISOString(),
            is_completed: false,
            created_by: site.created_by,
          });
      }
    } catch (crmError) {
      // Don't fail the lead submission if CRM auto-link fails
      console.error('[PublicListing] CRM auto-link error (non-fatal):', crmError);
    }

    // Increment lead count (fire and forget)
    supabaseAdmin
      .from('listing_sites')
      .update({ lead_count: (site.lead_count || 0) + 1 })
      .eq('id', site.id)
      .then(() => {});

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[PublicListing] Lead submit error:', error);
      res.status(500).json({ success: false, error: 'Failed to submit inquiry' });
    }
  }
};
