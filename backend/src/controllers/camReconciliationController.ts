import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const listCamReconciliations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id } = req.query;
    let query = supabaseAdmin.from('cam_reconciliations').select('*').order('period_start', { ascending: false });
    if (property_id) query = query.eq('master_property_id', property_id);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, reconciliations: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliations' });
  }
};

export const getCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('cam_reconciliations')
      .select('*, cam_reconciliation_items(*, tenants(tenant_name, unit_number))').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Reconciliation not found');
    res.json({ success: true, reconciliation: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation' });
  }
};

export const createCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { master_property_id, period, period_start, period_end, allocation_method } = req.body;
    if (!master_property_id || !period_start || !period_end) throw new AppError(400, 'Required fields missing');
    const { data, error } = await supabaseAdmin.from('cam_reconciliations')
      .insert({ master_property_id, period, period_start, period_end, allocation_method, created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ success: true, reconciliation: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create reconciliation' });
  }
};

export const calculateCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;

    const { data: recon, error: reconErr } = await supabaseAdmin.from('cam_reconciliations').select('*').eq('id', id).single();
    if (reconErr || !recon) throw new AppError(404, 'Reconciliation not found');

    // Sum CAM-recoverable expenses for the period
    const { data: expenses } = await supabaseAdmin.from('operating_expenses').select('amount')
      .eq('master_property_id', recon.master_property_id).eq('is_cam_recoverable', true)
      .gte('expense_date', recon.period_start).lte('expense_date', recon.period_end);

    const totalCam = (expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

    // Get active tenants
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id, leased_sf')
      .eq('master_property_id', recon.master_property_id).eq('is_active', true);
    if (!tenants || tenants.length === 0) throw new AppError(400, 'No active tenants');

    const totalSf = tenants.reduce((s: number, t: any) => s + (t.leased_sf || 0), 0);

    // Calculate shares
    const items = tenants.map((t: any) => {
      const share = recon.allocation_method === 'equal_share' ? (1 / tenants.length) : (totalSf > 0 ? (t.leased_sf || 0) / totalSf : 0);
      const allocated = totalCam * share;
      return { reconciliation_id: id, tenant_id: t.id, share_percent: share, allocated_amount: allocated, amount_paid: 0, balance_due: allocated };
    });

    // Replace items
    await supabaseAdmin.from('cam_reconciliation_items').delete().eq('reconciliation_id', id);
    if (items.length > 0) await supabaseAdmin.from('cam_reconciliation_items').insert(items);

    // Update totals
    const { data: updated } = await supabaseAdmin.from('cam_reconciliations')
      .update({ total_cam_expenses: totalCam, total_collected: 0, variance: totalCam }).eq('id', id).select().single();

    res.json({ success: true, reconciliation: updated, items });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    console.error('[CAM] Calculate error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate reconciliation' });
  }
};

export const updateCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('cam_reconciliations').update(req.body).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Reconciliation not found');
    res.json({ success: true, reconciliation: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update reconciliation' });
  }
};

export const finalizeCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('cam_reconciliations').update({ is_finalized: true }).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Reconciliation not found');
    res.json({ success: true, reconciliation: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to finalize' });
  }
};
