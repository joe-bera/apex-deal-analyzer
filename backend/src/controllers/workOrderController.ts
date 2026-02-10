import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const listWorkOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, vendor_id, status } = req.query;
    let query = supabaseAdmin.from('work_orders').select('*, vendors(name), tenants(tenant_name, unit_number)').order('created_at', { ascending: false });
    if (property_id) query = query.eq('master_property_id', property_id);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, work_orders: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch work orders' });
  }
};

export const getWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('work_orders')
      .select('*, vendors(name, phone, email), tenants(tenant_name, unit_number)').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Work order not found');
    res.json({ success: true, work_order: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch work order' });
  }
};

export const createWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    if (!req.body.master_property_id || !req.body.title) throw new AppError(400, 'master_property_id and title required');
    const { data, error } = await supabaseAdmin.from('work_orders')
      .insert({ ...req.body, status: req.body.status || 'open', created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ success: true, work_order: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create work order' });
  }
};

export const updateWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const updateData = { ...req.body };
    if (updateData.status === 'completed' && !updateData.completed_date) {
      updateData.completed_date = new Date().toISOString().split('T')[0];
    }
    const { data, error } = await supabaseAdmin.from('work_orders').update(updateData).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Work order not found');
    res.json({ success: true, work_order: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update work order' });
  }
};

export const deleteWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { error } = await supabaseAdmin.from('work_orders').delete().eq('id', req.params.id);
    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete work order' });
  }
};
