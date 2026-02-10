import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const listComplianceItems = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id } = req.query;
    let query = supabaseAdmin.from('compliance_items').select('*, vendors(name)').order('due_date', { ascending: true });
    if (property_id) query = query.eq('master_property_id', property_id);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, compliance_items: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch compliance items' });
  }
};

export const getComplianceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('compliance_items')
      .select('*, vendors(name, phone, email)').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Compliance item not found');
    res.json({ success: true, compliance_item: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch compliance item' });
  }
};

export const createComplianceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    if (!req.body.master_property_id || !req.body.title) throw new AppError(400, 'master_property_id and title required');
    const { data, error } = await supabaseAdmin.from('compliance_items')
      .insert({ ...req.body, created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ success: true, compliance_item: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create compliance item' });
  }
};

export const updateComplianceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('compliance_items').update(req.body).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Compliance item not found');
    res.json({ success: true, compliance_item: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update compliance item' });
  }
};

export const deleteComplianceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { error } = await supabaseAdmin.from('compliance_items').delete().eq('id', req.params.id);
    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete compliance item' });
  }
};

export const getUpcomingCompliance = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const days = parseInt(req.query.days as string) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabaseAdmin.from('compliance_items')
      .select('*, vendors(name), master_properties(property_name, address)')
      .is('completed_date', null)
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, compliance_items: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch upcoming compliance' });
  }
};
