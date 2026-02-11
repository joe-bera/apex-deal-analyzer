import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const getLeaseTerms = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { tenantId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tenant_lease_terms')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw new AppError(500, error.message);
    res.json({ success: true, lease_terms: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch lease terms' });
  }
};

export const upsertLeaseTerms = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { tenantId } = req.params;

    const {
      cam_cap_type, cam_cap_percent, cam_cap_base_amount,
      base_year, base_year_amount,
      expense_stop_amount, expense_stop_per_sf,
      has_gross_up, gross_up_occupancy_threshold,
      admin_fee_percent, excluded_categories,
      proration_start, proration_end, notes,
    } = req.body;

    const payload = {
      tenant_id: tenantId,
      cam_cap_type: cam_cap_type || 'none',
      cam_cap_percent: cam_cap_percent ?? null,
      cam_cap_base_amount: cam_cap_base_amount ?? null,
      base_year: base_year ?? null,
      base_year_amount: base_year_amount ?? null,
      expense_stop_amount: expense_stop_amount ?? null,
      expense_stop_per_sf: expense_stop_per_sf ?? false,
      has_gross_up: has_gross_up ?? false,
      gross_up_occupancy_threshold: gross_up_occupancy_threshold ?? null,
      admin_fee_percent: admin_fee_percent ?? null,
      excluded_categories: excluded_categories || [],
      proration_start: proration_start || null,
      proration_end: proration_end || null,
      notes: notes || null,
      created_by: req.user.id,
    };

    const { data, error } = await supabaseAdmin
      .from('tenant_lease_terms')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw new AppError(500, error.message);
    res.json({ success: true, lease_terms: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to save lease terms' });
  }
};

export const deleteLeaseTerms = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { tenantId } = req.params;

    const { error } = await supabaseAdmin
      .from('tenant_lease_terms')
      .delete()
      .eq('tenant_id', tenantId);

    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete lease terms' });
  }
};
