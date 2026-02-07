import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin as supabase } from '../config/supabase';
import { config } from '../config/env';
import { generateEmailContent } from '../services/emailContentService';
import {
  filterUnsubscribed,
  buildEmailHtml,
  sendEmail,
} from '../services/emailService';

// ============================================================================
// Helpers
// ============================================================================

/** Generate HMAC token for unsubscribe links */
const generateUnsubscribeToken = (email: string): string => {
  return crypto
    .createHmac('sha256', config.jwt.secret)
    .update(email.toLowerCase())
    .digest('hex');
};

/** Verify HMAC token for unsubscribe */
const verifyUnsubscribeToken = (email: string, token: string): boolean => {
  const expected = generateUnsubscribeToken(email);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
};

// ============================================================================
// Campaign CRUD
// ============================================================================

/** GET / — List user's campaigns, newest first */
export const listCampaigns = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ success: true, campaigns: data || [] });
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return res.status(500).json({ success: false, error: 'Failed to list campaigns' });
  }
};

/** GET /:id — Campaign + recipients list */
export const getCampaign = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: campaign, error: campError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (campError || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const { data: recipients, error: recError } = await supabase
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true });

    if (recError) throw recError;

    return res.json({
      success: true,
      campaign,
      recipients: recipients || [],
    });
  } catch (error) {
    console.error('Error getting campaign:', error);
    return res.status(500).json({ success: false, error: 'Failed to get campaign' });
  }
};

/** POST / — Create draft campaign */
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, campaign_type, subject, html_body, master_property_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const { data, error } = await supabase
      .from('email_campaigns')
      .insert({
        name,
        campaign_type: campaign_type || 'custom',
        subject: subject || null,
        html_body: html_body || null,
        master_property_id: master_property_id || null,
        status: 'draft',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, campaign: data });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
};

/** PATCH /:id — Update draft campaign only */
export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, campaign_type, subject, html_body, master_property_id } = req.body;

    // Verify ownership and draft status
    const { data: existing, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('status')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Only draft campaigns can be edited' });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (campaign_type !== undefined) updates.campaign_type = campaign_type;
    if (subject !== undefined) updates.subject = subject;
    if (html_body !== undefined) updates.html_body = html_body;
    if (master_property_id !== undefined) updates.master_property_id = master_property_id || null;

    const { data, error } = await supabase
      .from('email_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, campaign: data });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return res.status(500).json({ success: false, error: 'Failed to update campaign' });
  }
};

/** DELETE /:id — Delete draft campaign only */
export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify ownership and draft status
    const { data: existing, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('status')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Only draft campaigns can be deleted' });
    }

    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete campaign' });
  }
};

// ============================================================================
// AI Content Generation
// ============================================================================

/** POST /generate-content — AI subject + body from type + property + instructions */
export const generateContent = async (req: Request, res: Response) => {
  try {
    const { campaign_type, master_property_id, custom_instructions } = req.body;

    let property = null;
    if (master_property_id) {
      // Fetch property details for context
      const { data: propData } = await supabase
        .from('property_with_latest_transaction')
        .select('*')
        .eq('id', master_property_id)
        .single();

      if (propData) {
        property = {
          address: propData.address,
          city: propData.city,
          state: propData.state,
          property_type: propData.property_type,
          building_size: propData.building_size,
          lot_size_acres: propData.lot_size_acres,
          year_built: propData.year_built,
          sale_price: propData.latest_sale_price,
          asking_price: propData.latest_sale_price,
          price_per_sf: propData.latest_price_per_sf,
          cap_rate: propData.latest_cap_rate,
          clear_height_ft: propData.clear_height_ft,
          dock_doors: propData.dock_doors,
        };
      }
    }

    const content = await generateEmailContent(
      campaign_type || 'custom',
      property,
      custom_instructions
    );

    return res.json({ success: true, content });
  } catch (error) {
    console.error('Error generating email content:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate email content' });
  }
};

// ============================================================================
// Recipients
// ============================================================================

/** POST /:id/recipients — Add recipients by contact_ids[], contact_type, or tag. Dedupes by email */
export const addRecipients = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { contact_ids, contact_type, tag } = req.body;

    // Verify campaign ownership + draft status
    const { data: campaign, error: campError } = await supabase
      .from('email_campaigns')
      .select('status')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (campError || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Can only add recipients to draft campaigns' });
    }

    // Build contacts query based on filter type
    let contactQuery = supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('created_by', userId)
      .eq('is_deleted', false)
      .not('email', 'is', null);

    if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
      contactQuery = contactQuery.in('id', contact_ids);
    } else if (contact_type) {
      contactQuery = contactQuery.eq('contact_type', contact_type);
    } else if (tag) {
      contactQuery = contactQuery.contains('tags', [tag]);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide contact_ids, contact_type, or tag to add recipients',
      });
    }

    const { data: contacts, error: contactError } = await contactQuery;
    if (contactError) throw contactError;

    if (!contacts || contacts.length === 0) {
      return res.json({ success: true, added: 0, message: 'No matching contacts with emails found' });
    }

    // Get existing recipient emails to dedupe
    const { data: existingRecipients } = await supabase
      .from('email_recipients')
      .select('email')
      .eq('campaign_id', id);

    const existingEmails = new Set(
      (existingRecipients || []).map((r: any) => r.email.toLowerCase())
    );

    // Filter out duplicates
    const newRecipients = contacts
      .filter((c: any) => c.email && !existingEmails.has(c.email.toLowerCase()))
      .map((c: any) => ({
        campaign_id: id,
        contact_id: c.id,
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
        status: 'pending',
      }));

    if (newRecipients.length === 0) {
      return res.json({ success: true, added: 0, message: 'All contacts are already added' });
    }

    const { error: insertError } = await supabase
      .from('email_recipients')
      .insert(newRecipients);

    if (insertError) throw insertError;

    // Update total_recipients count
    const { count } = await supabase
      .from('email_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);

    await supabase
      .from('email_campaigns')
      .update({ total_recipients: count || 0, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true, added: newRecipients.length });
  } catch (error) {
    console.error('Error adding recipients:', error);
    return res.status(500).json({ success: false, error: 'Failed to add recipients' });
  }
};

/** DELETE /:id/recipients/:recipientId — Remove single recipient */
export const removeRecipient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id, recipientId } = req.params;

    // Verify campaign ownership
    const { data: campaign, error: campError } = await supabase
      .from('email_campaigns')
      .select('status')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (campError || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Can only remove recipients from draft campaigns' });
    }

    const { error } = await supabase
      .from('email_recipients')
      .delete()
      .eq('id', recipientId)
      .eq('campaign_id', id);

    if (error) throw error;

    // Update total_recipients count
    const { count } = await supabase
      .from('email_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);

    await supabase
      .from('email_campaigns')
      .update({ total_recipients: count || 0, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error removing recipient:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove recipient' });
  }
};

// ============================================================================
// Send Campaign
// ============================================================================

/** POST /:id/send — Send the campaign to all eligible recipients */
export const sendCampaign = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify campaign ownership and draft status
    const { data: campaign, error: campError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (campError || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Campaign has already been sent' });
    }

    if (!campaign.subject || !campaign.html_body) {
      return res.status(400).json({ success: false, error: 'Campaign must have a subject and body before sending' });
    }

    // Fetch pending recipients
    const { data: allRecipients, error: recError } = await supabase
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'pending');

    if (recError) throw recError;

    if (!allRecipients || allRecipients.length === 0) {
      return res.status(400).json({ success: false, error: 'No recipients to send to' });
    }

    // Filter out unsubscribed
    const eligibleRecipients = await filterUnsubscribed(allRecipients);

    // Mark skipped recipients (unsubscribed)
    const skippedIds = allRecipients
      .filter((r: any) => !eligibleRecipients.find((e: any) => e.id === r.id))
      .map((r: any) => r.id);

    if (skippedIds.length > 0) {
      await supabase
        .from('email_recipients')
        .update({ status: 'failed', error_message: 'Unsubscribed' })
        .in('id', skippedIds);
    }

    // Fetch broker profile for email template
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, company_phone, company_email, company_logo_url')
      .eq('id', userId)
      .single();

    const brokerInfo = profile || {};

    // Set campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Determine frontend URL for unsubscribe links
    const frontendUrl = config.cors.origin;

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of eligibleRecipients) {
      const token = generateUnsubscribeToken(recipient.email);
      const unsubscribeUrl = `${frontendUrl}/unsubscribe?email=${encodeURIComponent(recipient.email)}&token=${token}`;

      const html = buildEmailHtml({
        bodyHtml: campaign.html_body,
        brokerInfo,
        unsubscribeUrl,
        recipientName: recipient.first_name || undefined,
      });

      const result = await sendEmail({
        to: recipient.email,
        subject: campaign.subject,
        html,
      });

      if (result.success) {
        sentCount++;
        await supabase
          .from('email_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', recipient.id);
      } else {
        failedCount++;
        await supabase
          .from('email_recipients')
          .update({ status: 'failed', error_message: result.error || 'Send failed' })
          .eq('id', recipient.id);
      }
    }

    // Update campaign to sent
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        total_sent: sentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return res.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedIds.length,
      total: allRecipients.length,
    });
  } catch (error) {
    console.error('Error sending campaign:', error);
    return res.status(500).json({ success: false, error: 'Failed to send campaign' });
  }
};

// ============================================================================
// Unsubscribe (Public / No Auth)
// ============================================================================

/** POST /unsubscribe — Public endpoint for CAN-SPAM compliance */
export const handleUnsubscribe = async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ success: false, error: 'Email and token are required' });
    }

    // Verify HMAC token
    try {
      if (!verifyUnsubscribeToken(email, token)) {
        return res.status(400).json({ success: false, error: 'Invalid unsubscribe token' });
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid unsubscribe token' });
    }

    // Insert into unsubscribes (upsert to handle duplicates)
    const { error } = await supabase
      .from('email_unsubscribes')
      .upsert(
        { email: email.toLowerCase(), reason: 'user_unsubscribed', unsubscribed_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

    if (error) throw error;

    return res.json({ success: true, message: 'You have been unsubscribed successfully.' });
  } catch (error) {
    console.error('Error handling unsubscribe:', error);
    return res.status(500).json({ success: false, error: 'Failed to process unsubscribe' });
  }
};
