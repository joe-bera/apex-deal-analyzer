import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const listInspections = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id } = req.query;
    let query = supabaseAdmin.from('inspections').select('*, condition_items(*)').order('inspection_date', { ascending: false });
    if (property_id) query = query.eq('master_property_id', property_id);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, inspections: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch inspections' });
  }
};

export const getInspection = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('inspections')
      .select('*, condition_items(*)').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Inspection not found');
    res.json({ success: true, inspection: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch inspection' });
  }
};

export const createInspection = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { condition_items: items, ...inspectionFields } = req.body;
    if (!inspectionFields.master_property_id) throw new AppError(400, 'master_property_id required');

    const { data: inspection, error } = await supabaseAdmin.from('inspections')
      .insert({ ...inspectionFields, created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, error.message);

    if (items && Array.isArray(items) && items.length > 0) {
      const condItems = items.map((ci: any) => ({ ...ci, inspection_id: inspection.id }));
      await supabaseAdmin.from('condition_items').insert(condItems);
    }

    const { data: full } = await supabaseAdmin.from('inspections').select('*, condition_items(*)').eq('id', inspection.id).single();
    res.status(201).json({ success: true, inspection: full });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create inspection' });
  }
};

export const updateInspection = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { condition_items: _items, ...fields } = req.body;
    const { data, error } = await supabaseAdmin.from('inspections').update(fields).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Inspection not found');
    res.json({ success: true, inspection: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update inspection' });
  }
};

export const deleteInspection = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    await supabaseAdmin.from('condition_items').delete().eq('inspection_id', req.params.id);
    const { error } = await supabaseAdmin.from('inspections').delete().eq('id', req.params.id);
    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete inspection' });
  }
};

export const createConditionItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('condition_items')
      .insert({ ...req.body, inspection_id: req.params.id }).select().single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ success: true, condition_item: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create condition item' });
  }
};

export const updateConditionItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('condition_items').update(req.body).eq('id', req.params.itemId).select().single();
    if (error || !data) throw new AppError(404, 'Condition item not found');
    res.json({ success: true, condition_item: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update condition item' });
  }
};
