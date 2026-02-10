import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const getOwnerStatement = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, month } = req.query;
    if (!property_id || !month) throw new AppError(400, 'property_id and month (YYYY-MM) required');

    const [year, mon] = (month as string).split('-');
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().split('T')[0];

    // Management fee percent
    const { data: prop } = await supabaseAdmin.from('master_properties').select('management_fee_percent').eq('id', property_id).single();

    // Rent collected (via tenants join)
    const { data: payments } = await supabaseAdmin.from('rent_payments')
      .select('amount_paid, tenants!inner(master_property_id)')
      .eq('payment_status', 'received')
      .gte('period_start', startDate).lte('period_start', endDate)
      .eq('tenants.master_property_id', property_id as string);

    const totalRent = (payments || []).reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);

    // Expenses
    const { data: expenses } = await supabaseAdmin.from('operating_expenses').select('amount')
      .eq('master_property_id', property_id as string).gte('expense_date', startDate).lte('expense_date', endDate);

    const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const feePercent = prop?.management_fee_percent || 0;
    const mgmtFee = totalRent * (feePercent / 100);

    res.json({
      success: true,
      statement: {
        property_id, month,
        total_rent_collected: totalRent, total_expenses: totalExpenses,
        management_fee_percent: feePercent, management_fee: mgmtFee,
        net_to_owner: totalRent - totalExpenses - mgmtFee,
      },
    });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to generate statement' });
  }
};

export const getYearEndReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, year } = req.query;
    if (!property_id || !year) throw new AppError(400, 'property_id and year required');

    const { data: expenses } = await supabaseAdmin.from('operating_expenses').select('category, amount')
      .eq('master_property_id', property_id as string).gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`);

    const byCategory: Record<string, number> = {};
    (expenses || []).forEach((e: any) => { byCategory[e.category || 'other'] = (byCategory[e.category || 'other'] || 0) + (e.amount || 0); });
    const total = Object.values(byCategory).reduce((s, a) => s + a, 0);

    res.json({ success: true, report: { property_id, year, expenses_by_category: byCategory, total_expenses: total } });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to generate year-end report' });
  }
};

export const getBudgetVsActual = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { property_id, year } = req.query;
    if (!property_id || !year) throw new AppError(400, 'property_id and year required');

    const { data: budget } = await supabaseAdmin.from('property_budgets').select('*, budget_line_items(*)')
      .eq('master_property_id', property_id as string).eq('fiscal_year', year as string).maybeSingle();

    const { data: expenses } = await supabaseAdmin.from('operating_expenses').select('category, amount')
      .eq('master_property_id', property_id as string).gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`);

    const actual: Record<string, number> = {};
    (expenses || []).forEach((e: any) => { actual[e.category || 'other'] = (actual[e.category || 'other'] || 0) + (e.amount || 0); });

    const comparison = (budget?.budget_line_items || []).map((li: any) => {
      const act = actual[li.category] || 0;
      return { category: li.category, budgeted: li.budgeted_amount || 0, actual: act, variance: act - (li.budgeted_amount || 0) };
    });

    res.json({ success: true, report: { property_id, year, budget_id: budget?.id || null, comparison } });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to generate budget vs actual' });
  }
};
