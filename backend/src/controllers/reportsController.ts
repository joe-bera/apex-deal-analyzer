import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// Stage probability mapping for weighted pipeline value
const STAGE_PROBABILITIES: Record<string, number> = {
  prospecting: 10,
  qualification: 20,
  proposal: 40,
  negotiation: 60,
  under_contract: 75,
  due_diligence: 85,
  closing: 95,
};

function parseDateRange(req: Request): { start?: string; end?: string } {
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;
  return { start, end };
}

function toYYYYMM(dateStr: string): string {
  return dateStr.substring(0, 7);
}

/**
 * Pipeline Forecast
 * GET /api/reports/pipeline-forecast
 */
export const getPipelineForecast = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: deals, error } = await supabaseAdmin
      .from('crm_deals')
      .select('id, deal_name, stage, deal_value, probability_percent, expected_close_date')
      .eq('is_deleted', false)
      .not('stage', 'in', '("closed_won","closed_lost")');

    if (error) {
      console.error('Error fetching pipeline forecast:', error);
      throw new AppError(500, 'Failed to fetch pipeline forecast');
    }

    const allDeals = deals || [];

    // Group by stage
    const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'under_contract', 'due_diligence', 'closing'];
    const deals_by_stage = stages.map(stage => {
      const stageDeals = allDeals.filter((d: any) => d.stage === stage);
      const total_value = stageDeals.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0);
      const prob = STAGE_PROBABILITIES[stage] || 0;
      return {
        stage,
        count: stageDeals.length,
        total_value: Math.round(total_value),
        weighted_value: Math.round(total_value * prob / 100),
      };
    });

    const weighted_forecast_total = deals_by_stage.reduce((sum, s) => sum + s.weighted_value, 0);

    // Monthly projections by expected_close_date
    const monthMap = new Map<string, { month: string; total_value: number; weighted_value: number; deal_count: number }>();
    for (const deal of allDeals as any[]) {
      if (!deal.expected_close_date) continue;
      const month = toYYYYMM(deal.expected_close_date);
      const existing = monthMap.get(month) || { month, total_value: 0, weighted_value: 0, deal_count: 0 };
      const prob = deal.probability_percent ?? (STAGE_PROBABILITIES[deal.stage] || 0);
      existing.total_value += deal.deal_value || 0;
      existing.weighted_value += ((deal.deal_value || 0) * prob) / 100;
      existing.deal_count += 1;
      monthMap.set(month, existing);
    }

    const monthly_projections = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        total_value: Math.round(m.total_value),
        weighted_value: Math.round(m.weighted_value),
      }));

    res.status(200).json({
      success: true,
      deals_by_stage,
      weighted_forecast_total,
      monthly_projections,
      total_pipeline: deals_by_stage.reduce((sum, s) => sum + s.total_value, 0),
      active_deals: allDeals.length,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Broker Production
 * GET /api/reports/broker-production
 */
export const getBrokerProduction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { start, end } = parseDateRange(req);

    let query = supabaseAdmin
      .from('crm_deals')
      .select('id, deal_value, commission_total, assigned_to, actual_close_date, assigned_user:profiles!crm_deals_assigned_to_fkey(id, full_name)')
      .eq('is_deleted', false)
      .eq('stage', 'closed_won');

    if (start) query = query.gte('actual_close_date', start);
    if (end) query = query.lte('actual_close_date', end);

    const { data: deals, error } = await query;

    if (error) {
      console.error('Error fetching broker production:', error);
      throw new AppError(500, 'Failed to fetch broker production');
    }

    const brokerMap = new Map<string, {
      broker_id: string;
      broker_name: string;
      deals_closed: number;
      total_deal_value: number;
      total_commission: number;
    }>();

    for (const deal of (deals || []) as any[]) {
      const brokerId = deal.assigned_to || 'unassigned';
      const brokerName = deal.assigned_user?.full_name || 'Unassigned';
      const existing = brokerMap.get(brokerId) || {
        broker_id: brokerId,
        broker_name: brokerName,
        deals_closed: 0,
        total_deal_value: 0,
        total_commission: 0,
      };
      existing.deals_closed += 1;
      existing.total_deal_value += deal.deal_value || 0;
      existing.total_commission += deal.commission_total || 0;
      brokerMap.set(brokerId, existing);
    }

    const brokers = Array.from(brokerMap.values())
      .sort((a, b) => b.total_commission - a.total_commission)
      .map(b => ({
        ...b,
        total_deal_value: Math.round(b.total_deal_value),
        total_commission: Math.round(b.total_commission),
      }));

    res.status(200).json({
      success: true,
      brokers,
      totals: {
        deals_closed: brokers.reduce((sum, b) => sum + b.deals_closed, 0),
        total_deal_value: brokers.reduce((sum, b) => sum + b.total_deal_value, 0),
        total_commission: brokers.reduce((sum, b) => sum + b.total_commission, 0),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Revenue Report
 * GET /api/reports/revenue
 */
export const getRevenueReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { start, end } = parseDateRange(req);

    let query = supabaseAdmin
      .from('crm_deals')
      .select('id, deal_type, deal_value, commission_total, actual_close_date')
      .eq('is_deleted', false)
      .eq('stage', 'closed_won');

    if (start) query = query.gte('actual_close_date', start);
    if (end) query = query.lte('actual_close_date', end);

    const { data: deals, error } = await query;

    if (error) {
      console.error('Error fetching revenue report:', error);
      throw new AppError(500, 'Failed to fetch revenue report');
    }

    const allDeals = (deals || []) as any[];

    // Monthly breakdown
    const monthMap = new Map<string, { month: string; commission: number; deal_value: number; deal_count: number }>();
    for (const deal of allDeals) {
      if (!deal.actual_close_date) continue;
      const month = toYYYYMM(deal.actual_close_date);
      const existing = monthMap.get(month) || { month, commission: 0, deal_value: 0, deal_count: 0 };
      existing.commission += deal.commission_total || 0;
      existing.deal_value += deal.deal_value || 0;
      existing.deal_count += 1;
      monthMap.set(month, existing);
    }

    const monthly = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        commission: Math.round(m.commission),
        deal_value: Math.round(m.deal_value),
      }));

    // Type breakdown
    const typeMap = new Map<string, { deal_type: string; commission: number; count: number; deal_value: number }>();
    for (const deal of allDeals) {
      const type = deal.deal_type || 'unknown';
      const existing = typeMap.get(type) || { deal_type: type, commission: 0, count: 0, deal_value: 0 };
      existing.commission += deal.commission_total || 0;
      existing.count += 1;
      existing.deal_value += deal.deal_value || 0;
      typeMap.set(type, existing);
    }

    const type_breakdown = Array.from(typeMap.values())
      .sort((a, b) => b.commission - a.commission)
      .map(t => ({
        ...t,
        commission: Math.round(t.commission),
        deal_value: Math.round(t.deal_value),
      }));

    const totalCommission = allDeals.reduce((sum, d) => sum + (d.commission_total || 0), 0);
    const totalDealValue = allDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);

    res.status(200).json({
      success: true,
      monthly,
      type_breakdown,
      totals: {
        commission: Math.round(totalCommission),
        deal_value: Math.round(totalDealValue),
        deal_count: allDeals.length,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Activity Summary
 * GET /api/reports/activity-summary
 */
export const getActivitySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { start, end } = parseDateRange(req);

    let query = supabaseAdmin
      .from('activities')
      .select('id, activity_type, activity_date, is_completed');

    if (start) query = query.gte('activity_date', start);
    if (end) query = query.lte('activity_date', end);

    const { data: activities, error } = await query;

    if (error) {
      console.error('Error fetching activity summary:', error);
      throw new AppError(500, 'Failed to fetch activity summary');
    }

    const allActivities = (activities || []) as any[];

    // By type
    const typeMap = new Map<string, { type: string; count: number; completed: number }>();
    for (const act of allActivities) {
      const type = act.activity_type || 'other';
      const existing = typeMap.get(type) || { type, count: 0, completed: 0 };
      existing.count += 1;
      if (act.is_completed) existing.completed += 1;
      typeMap.set(type, existing);
    }

    const by_type = Array.from(typeMap.values()).sort((a, b) => b.count - a.count);

    // By period (monthly)
    const periodMap = new Map<string, { month: string; count: number }>();
    for (const act of allActivities) {
      if (!act.activity_date) continue;
      const month = toYYYYMM(act.activity_date);
      const existing = periodMap.get(month) || { month, count: 0 };
      existing.count += 1;
      periodMap.set(month, existing);
    }

    const by_period = Array.from(periodMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Task completion
    const tasks = allActivities.filter(a => a.activity_type === 'task');
    const completedTasks = tasks.filter(a => a.is_completed);

    res.status(200).json({
      success: true,
      by_type,
      by_period,
      task_completion: {
        total: tasks.length,
        completed: completedTasks.length,
        rate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      },
      total_activities: allActivities.length,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Property Analytics
 * GET /api/reports/property-analytics
 */
export const getPropertyAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: properties, error } = await supabaseAdmin
      .from('property_with_latest_transaction')
      .select('id, property_type, submarket, building_size, latest_sale_price, latest_price_per_sf, latest_cap_rate');

    if (error) {
      console.error('Error fetching property analytics:', error);
      throw new AppError(500, 'Failed to fetch property analytics');
    }

    const allProps = (properties || []) as any[];

    // By type
    const typeMap = new Map<string, { type: string; count: number; total_value: number; avg_price_sf: number; _total_price_sf: number; _price_sf_count: number }>();
    for (const p of allProps) {
      const type = p.property_type || 'unknown';
      const existing = typeMap.get(type) || { type, count: 0, total_value: 0, avg_price_sf: 0, _total_price_sf: 0, _price_sf_count: 0 };
      existing.count += 1;
      existing.total_value += p.latest_sale_price || 0;
      if (p.latest_price_per_sf) {
        existing._total_price_sf += p.latest_price_per_sf;
        existing._price_sf_count += 1;
      }
      typeMap.set(type, existing);
    }

    const by_type = Array.from(typeMap.values())
      .map(t => ({
        type: t.type,
        count: t.count,
        total_value: Math.round(t.total_value),
        avg_price_sf: t._price_sf_count > 0 ? Math.round(t._total_price_sf / t._price_sf_count) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // By submarket
    const subMap = new Map<string, { submarket: string; count: number; total_value: number; avg_price_sf: number; _total_price_sf: number; _price_sf_count: number }>();
    for (const p of allProps) {
      const sub = p.submarket || 'Unknown';
      const existing = subMap.get(sub) || { submarket: sub, count: 0, total_value: 0, avg_price_sf: 0, _total_price_sf: 0, _price_sf_count: 0 };
      existing.count += 1;
      existing.total_value += p.latest_sale_price || 0;
      if (p.latest_price_per_sf) {
        existing._total_price_sf += p.latest_price_per_sf;
        existing._price_sf_count += 1;
      }
      subMap.set(sub, existing);
    }

    const by_submarket = Array.from(subMap.values())
      .map(s => ({
        submarket: s.submarket,
        count: s.count,
        total_value: Math.round(s.total_value),
        avg_price_sf: s._price_sf_count > 0 ? Math.round(s._total_price_sf / s._price_sf_count) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Price/SF distribution buckets
    const priceSfBuckets = [
      { label: '<$50', min: 0, max: 50 },
      { label: '$50-$100', min: 50, max: 100 },
      { label: '$100-$150', min: 100, max: 150 },
      { label: '$150-$200', min: 150, max: 200 },
      { label: '$200-$300', min: 200, max: 300 },
      { label: '>$300', min: 300, max: Infinity },
    ];

    const price_sf_distribution = priceSfBuckets.map(bucket => ({
      range: bucket.label,
      count: allProps.filter(p => {
        const v = p.latest_price_per_sf;
        return v != null && v >= bucket.min && v < bucket.max;
      }).length,
    }));

    // CAP rate distribution buckets
    const capBuckets = [
      { label: '<4%', min: 0, max: 4 },
      { label: '4-5%', min: 4, max: 5 },
      { label: '5-6%', min: 5, max: 6 },
      { label: '6-7%', min: 6, max: 7 },
      { label: '7-8%', min: 7, max: 8 },
      { label: '>8%', min: 8, max: Infinity },
    ];

    const cap_rate_distribution = capBuckets.map(bucket => ({
      range: bucket.label,
      count: allProps.filter(p => {
        const v = p.latest_cap_rate;
        return v != null && v >= bucket.min && v < bucket.max;
      }).length,
    }));

    const totalValue = allProps.reduce((sum, p) => sum + (p.latest_sale_price || 0), 0);
    const propsWithPsf = allProps.filter(p => p.latest_price_per_sf);
    const avgPsf = propsWithPsf.length > 0
      ? propsWithPsf.reduce((sum, p) => sum + p.latest_price_per_sf, 0) / propsWithPsf.length
      : 0;
    const propsWithCap = allProps.filter(p => p.latest_cap_rate);
    const avgCap = propsWithCap.length > 0
      ? propsWithCap.reduce((sum, p) => sum + p.latest_cap_rate, 0) / propsWithCap.length
      : 0;

    res.status(200).json({
      success: true,
      by_type,
      by_submarket,
      price_sf_distribution,
      cap_rate_distribution,
      summary: {
        total_properties: allProps.length,
        total_value: Math.round(totalValue),
        avg_price_sf: Math.round(avgPsf),
        avg_cap_rate: Math.round(avgCap * 100) / 100,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Prospecting Report
 * GET /api/reports/prospecting
 */
export const getProspectingReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const [listsResult, itemsResult] = await Promise.all([
      supabaseAdmin.from('prospect_lists').select('id, name, result_count, created_at'),
      supabaseAdmin.from('prospect_list_items').select('id, list_id, status'),
    ]);

    if (listsResult.error) {
      console.error('Error fetching prospect lists:', listsResult.error);
      throw new AppError(500, 'Failed to fetch prospecting report');
    }
    if (itemsResult.error) {
      console.error('Error fetching prospect items:', itemsResult.error);
      throw new AppError(500, 'Failed to fetch prospecting report');
    }

    const lists = (listsResult.data || []) as any[];
    const items = (itemsResult.data || []) as any[];

    // Status distribution (all items)
    const statusMap = new Map<string, number>();
    for (const item of items) {
      const status = item.status || 'pending';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    }

    const status_distribution = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    // Conversion rates
    const totalItems = items.length;
    const contacted = items.filter(i => i.status === 'contacted').length;
    const qualified = items.filter(i => i.status === 'qualified').length;
    const notInterested = items.filter(i => i.status === 'not_interested').length;

    const conversion_rates = {
      total: totalItems,
      contacted,
      qualified,
      not_interested: notInterested,
      contact_rate: totalItems > 0 ? Math.round(((contacted + qualified + notInterested) / totalItems) * 100) : 0,
      qualification_rate: totalItems > 0 ? Math.round((qualified / totalItems) * 100) : 0,
    };

    // Per list breakdown
    const per_list_breakdown = lists.map(list => {
      const listItems = items.filter(i => i.list_id === list.id);
      const breakdown: Record<string, number> = {};
      for (const item of listItems) {
        const status = item.status || 'pending';
        breakdown[status] = (breakdown[status] || 0) + 1;
      }
      return {
        list_id: list.id,
        list_name: list.name,
        total_items: listItems.length,
        ...breakdown,
      };
    });

    res.status(200).json({
      success: true,
      status_distribution,
      conversion_rates,
      per_list_breakdown,
      total_lists: lists.length,
      total_items: totalItems,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Export Report as CSV
 * GET /api/reports/:type/export
 */
export const exportReportCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { type } = req.params;

    // Simulate the request to get data from internal handlers
    let csvHeaders: string[] = [];
    let csvRows: string[][] = [];
    const filename = `${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;

    switch (type) {
      case 'pipeline-forecast': {
        // Fetch pipeline data inline
        const { data: deals } = await supabaseAdmin
          .from('crm_deals')
          .select('id, deal_name, stage, deal_value, probability_percent, expected_close_date')
          .eq('is_deleted', false)
          .not('stage', 'in', '("closed_won","closed_lost")');

        csvHeaders = ['Stage', 'Deal Name', 'Deal Value', 'Probability %', 'Weighted Value', 'Expected Close'];
        csvRows = ((deals || []) as any[]).map(d => {
          const prob = d.probability_percent ?? (STAGE_PROBABILITIES[d.stage] || 0);
          return [
            d.stage,
            d.deal_name || '',
            String(d.deal_value || 0),
            String(prob),
            String(Math.round(((d.deal_value || 0) * prob) / 100)),
            d.expected_close_date || '',
          ];
        });
        break;
      }

      case 'broker-production': {
        const { start, end } = parseDateRange(req);
        let query = supabaseAdmin
          .from('crm_deals')
          .select('id, deal_name, deal_value, commission_total, assigned_to, actual_close_date, assigned_user:profiles!crm_deals_assigned_to_fkey(full_name)')
          .eq('is_deleted', false)
          .eq('stage', 'closed_won');
        if (start) query = query.gte('actual_close_date', start);
        if (end) query = query.lte('actual_close_date', end);

        const { data: deals } = await query;
        csvHeaders = ['Broker', 'Deal Name', 'Deal Value', 'Commission', 'Close Date'];
        csvRows = ((deals || []) as any[]).map(d => [
          d.assigned_user?.full_name || 'Unassigned',
          d.deal_name || '',
          String(d.deal_value || 0),
          String(d.commission_total || 0),
          d.actual_close_date || '',
        ]);
        break;
      }

      case 'revenue': {
        const { start, end } = parseDateRange(req);
        let query = supabaseAdmin
          .from('crm_deals')
          .select('id, deal_name, deal_type, deal_value, commission_total, actual_close_date')
          .eq('is_deleted', false)
          .eq('stage', 'closed_won');
        if (start) query = query.gte('actual_close_date', start);
        if (end) query = query.lte('actual_close_date', end);

        const { data: deals } = await query;
        csvHeaders = ['Deal Name', 'Type', 'Deal Value', 'Commission', 'Close Date'];
        csvRows = ((deals || []) as any[]).map(d => [
          d.deal_name || '',
          d.deal_type || '',
          String(d.deal_value || 0),
          String(d.commission_total || 0),
          d.actual_close_date || '',
        ]);
        break;
      }

      case 'activity-summary': {
        const { start, end } = parseDateRange(req);
        let query = supabaseAdmin
          .from('activities')
          .select('id, activity_type, subject, activity_date, is_completed');
        if (start) query = query.gte('activity_date', start);
        if (end) query = query.lte('activity_date', end);

        const { data: activities } = await query;
        csvHeaders = ['Type', 'Subject', 'Date', 'Completed'];
        csvRows = ((activities || []) as any[]).map(a => [
          a.activity_type || '',
          a.subject || '',
          a.activity_date || '',
          a.is_completed ? 'Yes' : 'No',
        ]);
        break;
      }

      case 'property-analytics': {
        const { data: properties } = await supabaseAdmin
          .from('property_with_latest_transaction')
          .select('address, city, state, property_type, submarket, building_size, latest_sale_price, latest_price_per_sf, latest_cap_rate');

        csvHeaders = ['Address', 'City', 'State', 'Type', 'Submarket', 'Building SF', 'Sale Price', 'Price/SF', 'Cap Rate'];
        csvRows = ((properties || []) as any[]).map(p => [
          p.address || '',
          p.city || '',
          p.state || '',
          p.property_type || '',
          p.submarket || '',
          String(p.building_size || ''),
          String(p.latest_sale_price || ''),
          String(p.latest_price_per_sf || ''),
          String(p.latest_cap_rate || ''),
        ]);
        break;
      }

      case 'prospecting': {
        const { data: items } = await supabaseAdmin
          .from('prospect_list_items')
          .select('status, list_id');

        const { data: lists } = await supabaseAdmin
          .from('prospect_lists')
          .select('id, name');

        const listMap = new Map((lists || []).map((l: any) => [l.id, l.name]));
        csvHeaders = ['List Name', 'Status', 'Count'];

        // Aggregate by list + status
        const agg = new Map<string, number>();
        for (const item of (items || []) as any[]) {
          const key = `${item.list_id}||${item.status || 'pending'}`;
          agg.set(key, (agg.get(key) || 0) + 1);
        }

        csvRows = Array.from(agg.entries()).map(([key, count]) => {
          const [listId, status] = key.split('||');
          return [listMap.get(listId) || listId, status, String(count)];
        });
        break;
      }

      default:
        throw new AppError(400, `Unknown report type: ${type}`);
    }

    // Build CSV string
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csv = [
      csvHeaders.map(escapeCsv).join(','),
      ...csvRows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
