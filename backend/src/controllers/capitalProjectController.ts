import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const listCapitalProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, status } = req.query;
    let query = supabaseAdmin.from('capital_projects').select('*, vendors(name)').order('created_at', { ascending: false });
    if (property_id) query = query.eq('master_property_id', property_id);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, capital_projects: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch capital projects' });
  }
};

export const getCapitalProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('capital_projects')
      .select('*, vendors(name, phone, email)').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Capital project not found');
    res.json({ success: true, capital_project: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch capital project' });
  }
};

export const createCapitalProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    if (!req.body.master_property_id || !req.body.title) throw new AppError(400, 'master_property_id and title required');
    const { data, error } = await supabaseAdmin.from('capital_projects')
      .insert({ ...req.body, status: req.body.status || 'proposed', created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ success: true, capital_project: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create capital project' });
  }
};

export const updateCapitalProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const updateData = { ...req.body };
    if (updateData.status === 'completed' && !updateData.actual_completion) {
      updateData.actual_completion = new Date().toISOString().split('T')[0];
    }
    const { data, error } = await supabaseAdmin.from('capital_projects').update(updateData).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Capital project not found');
    res.json({ success: true, capital_project: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update capital project' });
  }
};

export const deleteCapitalProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { error } = await supabaseAdmin.from('capital_projects').delete().eq('id', req.params.id);
    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete capital project' });
  }
};
