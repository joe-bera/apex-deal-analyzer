import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// List rent payments (by tenant, property, or period)
export const listRentPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { tenant_id, property_id, period_start, period_end } = req.query;

    let query = supabaseAdmin
      .from('rent_payments')
      .select('*, tenants!inner(tenant_name, unit_number, master_property_id)')
      .order('period_start', { ascending: false });

    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    if (property_id) query = query.eq('tenants.master_property_id', property_id);
    if (period_start) query = query.gte('period_start', period_start);
    if (period_end) query = query.lte('period_end', period_end);

    const { data, error } = await query;

    if (error) throw new AppError(500, `Failed to fetch rent payments: ${error.message}`);

    res.json({ success: true, payments: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[RentPayments] List error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch rent payments' });
    }
  }
};

// Create rent payment
export const createRentPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { tenant_id, ...rest } = req.body;
    if (!tenant_id) throw new AppError(400, 'Tenant ID is required');

    const { data, error } = await supabaseAdmin
      .from('rent_payments')
      .insert({ tenant_id, ...rest, created_by: req.user.id })
      .select()
      .single();

    if (error) throw new AppError(500, `Failed to create rent payment: ${error.message}`);

    res.status(201).json({ success: true, payment: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[RentPayments] Create error:', error);
      res.status(500).json({ success: false, error: 'Failed to create rent payment' });
    }
  }
};

// Update rent payment
export const updateRentPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('rent_payments')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new AppError(404, 'Rent payment not found');

    res.json({ success: true, payment: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[RentPayments] Update error:', error);
      res.status(500).json({ success: false, error: 'Failed to update rent payment' });
    }
  }
};

// Bulk create rent payments for all active tenants in a property for a given month
export const bulkCreateRentPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { property_id, period_start, period_end } = req.body;
    if (!property_id || !period_start || !period_end) {
      throw new AppError(400, 'property_id, period_start, and period_end are required');
    }

    // Get all active tenants for this property
    const { data: tenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, monthly_base_rent')
      .eq('master_property_id', property_id)
      .eq('is_active', true);

    if (tenantError) throw new AppError(500, `Failed to fetch tenants: ${tenantError.message}`);
    if (!tenants || tenants.length === 0) throw new AppError(400, 'No active tenants found');

    // Create payment records
    const payments = tenants.map(t => ({
      tenant_id: t.id,
      period_start,
      period_end,
      amount_due: t.monthly_base_rent || 0,
      amount_paid: 0,
      payment_status: 'expected' as const,
      created_by: req.user!.id,
    }));

    const { data, error } = await supabaseAdmin
      .from('rent_payments')
      .insert(payments)
      .select();

    if (error) throw new AppError(500, `Failed to create rent payments: ${error.message}`);

    res.status(201).json({ success: true, payments: data, count: data?.length || 0 });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[RentPayments] Bulk create error:', error);
      res.status(500).json({ success: false, error: 'Failed to bulk create rent payments' });
    }
  }
};
