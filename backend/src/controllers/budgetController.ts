import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const listBudgets = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id } = req.query;
    let query = supabaseAdmin.from('property_budgets').select('*, budget_line_items(*)').order('fiscal_year', { ascending: false });
    if (property_id) query = query.eq('master_property_id', property_id);
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);
    res.json({ success: true, budgets: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch budgets' });
  }
};

export const getBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('property_budgets')
      .select('*, budget_line_items(*)').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Budget not found');
    res.json({ success: true, budget: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch budget' });
  }
};

export const createBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { master_property_id, fiscal_year, total_budget, notes, line_items } = req.body;
    if (!master_property_id || !fiscal_year) throw new AppError(400, 'master_property_id and fiscal_year required');

    const { data: budget, error } = await supabaseAdmin.from('property_budgets')
      .insert({ master_property_id, fiscal_year, total_budget: total_budget || 0, notes, created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, error.message);

    if (line_items && Array.isArray(line_items) && line_items.length > 0) {
      const items = line_items.map((li: any) => ({ budget_id: budget.id, category: li.category, budgeted_amount: li.budgeted_amount || 0, notes: li.notes }));
      await supabaseAdmin.from('budget_line_items').insert(items);
    }

    const { data: full } = await supabaseAdmin.from('property_budgets').select('*, budget_line_items(*)').eq('id', budget.id).single();
    res.status(201).json({ success: true, budget: full });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create budget' });
  }
};

export const updateBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { line_items, ...budgetFields } = req.body;
    const { data, error } = await supabaseAdmin.from('property_budgets').update(budgetFields).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Budget not found');

    if (line_items && Array.isArray(line_items)) {
      await supabaseAdmin.from('budget_line_items').delete().eq('budget_id', req.params.id);
      if (line_items.length > 0) {
        const items = line_items.map((li: any) => ({ budget_id: req.params.id, category: li.category, budgeted_amount: li.budgeted_amount || 0, actual_amount: li.actual_amount || 0, notes: li.notes }));
        await supabaseAdmin.from('budget_line_items').insert(items);
      }
    }

    const { data: full } = await supabaseAdmin.from('property_budgets').select('*, budget_line_items(*)').eq('id', req.params.id).single();
    res.json({ success: true, budget: full });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update budget' });
  }
};

export const deleteBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    await supabaseAdmin.from('budget_line_items').delete().eq('budget_id', req.params.id);
    const { error } = await supabaseAdmin.from('property_budgets').delete().eq('id', req.params.id);
    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete budget' });
  }
};
