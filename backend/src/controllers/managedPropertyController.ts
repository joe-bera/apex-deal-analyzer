import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// Toggle management status and set management fields
export const updateManagement = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;
    const { is_managed, management_tier, management_fee_percent,
            management_start_date, management_end_date,
            management_agreement_url, management_notes, owner_contact_id } = req.body;

    const updates: Record<string, unknown> = {};
    if (is_managed !== undefined) updates.is_managed = is_managed;
    if (management_tier !== undefined) updates.management_tier = management_tier;
    if (management_fee_percent !== undefined) updates.management_fee_percent = management_fee_percent;
    if (management_start_date !== undefined) updates.management_start_date = management_start_date;
    if (management_end_date !== undefined) updates.management_end_date = management_end_date;
    if (management_agreement_url !== undefined) updates.management_agreement_url = management_agreement_url;
    if (management_notes !== undefined) updates.management_notes = management_notes;
    if (owner_contact_id !== undefined) updates.owner_contact_id = owner_contact_id;

    const { data, error } = await supabaseAdmin
      .from('master_properties')
      .update(updates)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error || !data) throw new AppError(404, 'Property not found');

    res.json({ success: true, property: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[ManagedProperty] Update management error:', error);
      res.status(500).json({ success: false, error: 'Failed to update management settings' });
    }
  }
};

// List managed properties with summary stats
export const listManagedProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data, error } = await supabaseAdmin
      .from('managed_properties_summary')
      .select('*')
      .order('address');

    if (error) throw new AppError(500, `Failed to fetch managed properties: ${error.message}`);

    res.json({ success: true, properties: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[ManagedProperty] List error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch managed properties' });
    }
  }
};
