import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { callClaude, parseClaudeJSON } from '../services/claudeService';

export const listExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, category, start_date, end_date } = req.query;

    let query = supabaseAdmin.from('operating_expenses').select('*').order('expense_date', { ascending: false });
    if (property_id) query = query.eq('master_property_id', property_id);
    if (category) query = query.eq('category', category);
    if (start_date) query = query.gte('expense_date', start_date);
    if (end_date) query = query.lte('expense_date', end_date);

    const { data, error } = await query;
    if (error) throw new AppError(500, `Failed to fetch expenses: ${error.message}`);
    res.json({ success: true, expenses: data || [] });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    console.error('[Expenses] List error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
};

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { master_property_id, ...rest } = req.body;
    if (!master_property_id) throw new AppError(400, 'master_property_id is required');

    const { data, error } = await supabaseAdmin.from('operating_expenses')
      .insert({ ...rest, master_property_id, created_by: req.user.id }).select().single();
    if (error) throw new AppError(500, `Failed to create expense: ${error.message}`);
    res.status(201).json({ success: true, expense: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
};

export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('operating_expenses').update(req.body).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError(404, 'Expense not found');
    res.json({ success: true, expense: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { error } = await supabaseAdmin.from('operating_expenses').delete().eq('id', req.params.id);
    if (error) throw new AppError(500, `Failed to delete expense: ${error.message}`);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
};

export const bulkCreateExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, expenses } = req.body;
    if (!property_id || !Array.isArray(expenses)) throw new AppError(400, 'property_id and expenses array required');

    const rows = expenses.map((e: any) => ({ ...e, master_property_id: property_id, created_by: req.user!.id }));
    const { data, error } = await supabaseAdmin.from('operating_expenses').insert(rows).select();
    if (error) throw new AppError(500, `Failed to create expenses: ${error.message}`);
    res.status(201).json({ success: true, expenses: data, count: data?.length || 0 });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to bulk create expenses' });
  }
};

export const categorizeExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { expenses } = req.body;
    if (!Array.isArray(expenses) || expenses.length === 0) throw new AppError(400, 'expenses array required');

    const categories = 'property_tax, insurance, utilities_water, utilities_electric, utilities_gas, utilities_trash, maintenance_repair, landscaping, janitorial, security, management_fee, legal, accounting, marketing, capital_improvement, pest_control, hvac, roof_repair, parking_lot, signage, other';

    const response = await callClaude({
      systemPrompt: `You are an expert at categorizing commercial real estate operating expenses. Available categories: ${categories}. For each expense, return JSON array: [{"category":"...", "is_cam_recoverable": true/false, "confidence": 0.0-1.0}]. Property taxes, insurance, and common area utilities are usually CAM recoverable. Management fees are not.`,
      prompt: `Categorize these expenses:\n${JSON.stringify(expenses)}`,
      maxTokens: 2048,
      temperature: 0,
    });

    const categorized = parseClaudeJSON<Array<{ category: string; is_cam_recoverable: boolean; confidence: number }>>(response.content);
    res.json({ success: true, categorized_expenses: categorized });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    console.error('[Expenses] Categorize error:', error);
    res.status(500).json({ success: false, error: 'Failed to categorize expenses' });
  }
};
