import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { callClaude, parseClaudeJSON } from '../services/claudeService';

// ============================================================================
// List all CAM reconciliations (optionally filtered by property_id)
// ============================================================================
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

// ============================================================================
// Get a single CAM reconciliation with items + tenant details
// ============================================================================
export const getCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin.from('cam_reconciliations')
      .select('*, cam_reconciliation_items(*, tenants(tenant_name, unit_number, leased_sf, lease_start, lease_end))').eq('id', req.params.id).single();
    if (error || !data) throw new AppError(404, 'Reconciliation not found');
    res.json({ success: true, reconciliation: data });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation' });
  }
};

// ============================================================================
// Create a new CAM reconciliation
// ============================================================================
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

// ============================================================================
// Enhanced CAM Reconciliation Engine
// Supports: gross-up, base year, expense stops, caps, proration, admin fees, exclusions
// ============================================================================
export const calculateCamReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;

    // 1. Load reconciliation
    const { data: recon, error: reconErr } = await supabaseAdmin
      .from('cam_reconciliations').select('*').eq('id', id).single();
    if (reconErr || !recon) throw new AppError(404, 'Reconciliation not found');
    if (recon.is_finalized) throw new AppError(400, 'Cannot recalculate a finalized reconciliation');

    // 2. Sum CAM-recoverable expenses by category for the period
    const { data: expenses } = await supabaseAdmin
      .from('operating_expenses')
      .select('amount, category')
      .eq('master_property_id', recon.master_property_id)
      .eq('is_cam_recoverable', true)
      .gte('expense_date', recon.period_start)
      .lte('expense_date', recon.period_end);

    const expenseList = expenses || [];
    const totalCamActual = expenseList.reduce((s: number, e: any) => s + (e.amount || 0), 0);

    // Build category totals map
    const categoryTotals: Record<string, number> = {};
    for (const e of expenseList) {
      const cat = e.category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    }

    // 3. Get active tenants with lease terms
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, tenant_name, unit_number, leased_sf, lease_start, lease_end')
      .eq('master_property_id', recon.master_property_id)
      .eq('is_active', true);

    if (!tenants || tenants.length === 0) throw new AppError(400, 'No active tenants');

    // Load lease terms for all tenants
    const tenantIds = tenants.map((t: any) => t.id);
    const { data: allLeaseTerms } = await supabaseAdmin
      .from('tenant_lease_terms')
      .select('*')
      .in('tenant_id', tenantIds);

    const leaseTermsMap: Record<string, any> = {};
    for (const lt of (allLeaseTerms || [])) {
      leaseTermsMap[lt.tenant_id] = lt;
    }

    // Get building total SF from property
    const { data: property } = await supabaseAdmin
      .from('master_properties')
      .select('building_size')
      .eq('id', recon.master_property_id)
      .single();

    const buildingTotalSf = property?.building_size || tenants.reduce((s: number, t: any) => s + (t.leased_sf || 0), 0);
    const totalLeasedSf = tenants.reduce((s: number, t: any) => s + (t.leased_sf || 0), 0);
    const occupancyRate = buildingTotalSf > 0 ? totalLeasedSf / buildingTotalSf : 1;

    // 4. Gross-up: check if any tenant has gross_up provision
    // Variable expense categories (can be grossed up)
    const variableCategories = new Set([
      'utilities_water', 'utilities_electric', 'utilities_gas', 'utilities_trash',
      'maintenance_repair', 'landscaping', 'janitorial', 'security',
      'pest_control', 'hvac', 'parking_lot', 'signage', 'other',
    ]);

    // Determine gross-up threshold (use lowest threshold among tenants with gross-up)
    let grossUpThreshold = 1.0; // default: no gross-up
    let hasAnyGrossUp = false;
    for (const lt of Object.values(leaseTermsMap) as any[]) {
      if (lt.has_gross_up && lt.gross_up_occupancy_threshold) {
        hasAnyGrossUp = true;
        const thresh = lt.gross_up_occupancy_threshold / 100;
        if (thresh < grossUpThreshold) grossUpThreshold = thresh;
      }
    }

    let totalGrossUp = 0;
    let grossedUpTotal = totalCamActual;

    if (hasAnyGrossUp && occupancyRate < grossUpThreshold) {
      // Only gross up variable expenses
      let variableTotal = 0;
      let fixedTotal = 0;
      for (const [cat, amt] of Object.entries(categoryTotals)) {
        if (variableCategories.has(cat)) {
          variableTotal += amt;
        } else {
          fixedTotal += amt;
        }
      }
      const grossedUpVariable = occupancyRate > 0 ? variableTotal / occupancyRate : variableTotal;
      totalGrossUp = grossedUpVariable - variableTotal;
      grossedUpTotal = fixedTotal + grossedUpVariable;
    }

    // 5. Reconciliation period info
    const periodStart = new Date(recon.period_start);
    const periodEnd = new Date(recon.period_end);
    const periodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 6. Per-tenant calculation
    const items = tenants.map((t: any) => {
      const lt = leaseTermsMap[t.id] || {};
      const tenantSf = t.leased_sf || 0;

      // Pro-rata share
      const proRataShare = recon.allocation_method === 'equal_share'
        ? (1 / tenants.length)
        : (buildingTotalSf > 0 ? tenantSf / buildingTotalSf : 0);

      // Raw allocation from grossed-up pool
      const rawAllocated = grossedUpTotal * proRataShare;

      // Excluded categories: subtract tenant-specific excluded expense categories
      let excludedAmount = 0;
      if (lt.excluded_categories && lt.excluded_categories.length > 0) {
        for (const cat of lt.excluded_categories) {
          if (categoryTotals[cat]) {
            excludedAmount += categoryTotals[cat] * proRataShare;
          }
        }
      }

      const afterExclusions = rawAllocated - excludedAmount;

      // Admin fee
      const adminFeePercent = lt.admin_fee_percent || 0;
      const adminFee = afterExclusions * (adminFeePercent / 100);

      const preCapAmount = afterExclusions + adminFee;

      // Base year credit
      let baseYearCredit = 0;
      if (lt.base_year && lt.base_year_amount) {
        baseYearCredit = lt.base_year_amount * proRataShare;
      }

      // Expense stop credit
      let expenseStopCredit = 0;
      if (lt.expense_stop_amount) {
        const stopAmount = lt.expense_stop_per_sf
          ? lt.expense_stop_amount * tenantSf
          : lt.expense_stop_amount;
        // Tenant only pays above the stop, so credit = min(stop, preCapAmount)
        expenseStopCredit = Math.min(stopAmount, preCapAmount);
      }

      let afterCredits = preCapAmount - baseYearCredit - expenseStopCredit;
      afterCredits = Math.max(0, afterCredits);

      // CAM cap
      let camCapApplied = 0;
      if (lt.cam_cap_type && lt.cam_cap_type !== 'none' && lt.cam_cap_percent && lt.cam_cap_base_amount) {
        const capPercent = lt.cam_cap_percent / 100;
        const baseAmount = lt.cam_cap_base_amount;

        // Years since base — use base_year or fallback to 1
        const reconYear = new Date(recon.period_start).getFullYear();
        const baseYear = lt.base_year || reconYear;
        const yearsSinceBase = Math.max(0, reconYear - baseYear);

        let maxAllowed: number;
        if (lt.cam_cap_type === 'cumulative') {
          // Cumulative: base * (1 + rate * years)
          maxAllowed = baseAmount * (1 + capPercent * yearsSinceBase);
        } else {
          // Compounded: base * (1 + rate)^years
          maxAllowed = baseAmount * Math.pow(1 + capPercent, yearsSinceBase);
        }

        if (afterCredits > maxAllowed) {
          camCapApplied = afterCredits - maxAllowed;
          afterCredits = maxAllowed;
        }
      }

      // Proration: days tenant occupied / total period days
      let prorationFactor = 1.0;
      if (lt.proration_start || lt.proration_end) {
        const tenantStart = lt.proration_start ? new Date(lt.proration_start) : periodStart;
        const tenantEnd = lt.proration_end ? new Date(lt.proration_end) : periodEnd;
        const effectiveStart = tenantStart > periodStart ? tenantStart : periodStart;
        const effectiveEnd = tenantEnd < periodEnd ? tenantEnd : periodEnd;
        const tenantDays = Math.max(0, Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        prorationFactor = periodDays > 0 ? tenantDays / periodDays : 1;
      }

      const finalAmount = Math.round(afterCredits * prorationFactor * 100) / 100;

      // Gross-up amount attributed to this tenant
      const tenantGrossUp = totalGrossUp * proRataShare;

      return {
        reconciliation_id: id,
        tenant_id: t.id,
        share_percent: proRataShare,
        allocated_amount: finalAmount,
        amount_paid: 0,
        balance_due: finalAmount,
        pre_cap_amount: Math.round(preCapAmount * 100) / 100,
        cam_cap_applied: Math.round(camCapApplied * 100) / 100,
        base_year_credit: Math.round(baseYearCredit * 100) / 100,
        expense_stop_credit: Math.round(expenseStopCredit * 100) / 100,
        gross_up_amount: Math.round(tenantGrossUp * 100) / 100,
        admin_fee: Math.round(adminFee * 100) / 100,
        proration_factor: Math.round(prorationFactor * 10000) / 10000,
        excluded_amount: Math.round(excludedAmount * 100) / 100,
      };
    });

    // 7. Replace existing items
    await supabaseAdmin.from('cam_reconciliation_items').delete().eq('reconciliation_id', id);
    if (items.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('cam_reconciliation_items').insert(items);
      if (insertErr) throw new AppError(500, `Failed to insert items: ${insertErr.message}`);
    }

    // 8. Update reconciliation totals
    const totalAllocated = items.reduce((s, i) => s + i.allocated_amount, 0);
    const { data: updated } = await supabaseAdmin.from('cam_reconciliations')
      .update({
        total_cam_expenses: totalCamActual,
        total_collected: 0,
        variance: totalAllocated,
        total_gross_up: Math.round(totalGrossUp * 100) / 100,
        grossed_up_total: Math.round(grossedUpTotal * 100) / 100,
        building_total_sf: buildingTotalSf,
      })
      .eq('id', id).select().single();

    res.json({ success: true, reconciliation: updated, items });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    console.error('[CAM] Calculate error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate reconciliation' });
  }
};

// ============================================================================
// Update CAM reconciliation metadata
// ============================================================================
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

// ============================================================================
// Finalize a CAM reconciliation
// ============================================================================
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

// ============================================================================
// Expense breakdown by category for a reconciliation period
// ============================================================================
export const getCamExpenseBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;

    const { data: recon } = await supabaseAdmin
      .from('cam_reconciliations').select('master_property_id, period_start, period_end').eq('id', id).single();
    if (!recon) throw new AppError(404, 'Reconciliation not found');

    const { data: expenses } = await supabaseAdmin
      .from('operating_expenses')
      .select('category, description, amount, expense_date, vendor_id')
      .eq('master_property_id', recon.master_property_id)
      .eq('is_cam_recoverable', true)
      .gte('expense_date', recon.period_start)
      .lte('expense_date', recon.period_end)
      .order('expense_date', { ascending: true });

    const list = expenses || [];
    const categoryMap: Record<string, { total: number; count: number; items: any[] }> = {};
    let grandTotal = 0;

    for (const e of list) {
      const cat = e.category || 'other';
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0, items: [] };
      categoryMap[cat].total += e.amount || 0;
      categoryMap[cat].count += 1;
      categoryMap[cat].items.push(e);
      grandTotal += e.amount || 0;
    }

    const breakdown = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      percent_of_total: grandTotal > 0 ? Math.round((data.total / grandTotal) * 10000) / 100 : 0,
      items: data.items,
    })).sort((a, b) => b.total - a.total);

    res.json({ success: true, breakdown, grand_total: Math.round(grandTotal * 100) / 100 });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to fetch expense breakdown' });
  }
};

// ============================================================================
// AI Lease Abstraction — extract CAM-specific terms from lease text
// ============================================================================
export const extractLeaseTerms = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { tenant_id, document_text } = req.body;
    if (!tenant_id || !document_text) throw new AppError(400, 'tenant_id and document_text are required');

    const prompt = `You are a commercial real estate lease abstraction specialist. Extract the following CAM (Common Area Maintenance) data points from this lease document text. Return ONLY valid JSON with these exact keys.

If a field is not found in the document, use null. For boolean fields, use true/false. For arrays, use an empty array if not found.

Required JSON schema:
{
  "lease_type": "nnn" | "modified_gross" | "gross" | "nn" | "percentage" | "month_to_month" | "ground" | null,
  "lease_start": "YYYY-MM-DD" | null,
  "lease_end": "YYYY-MM-DD" | null,
  "leased_sf": number | null,
  "monthly_base_rent": number | null,
  "cam_cap_type": "none" | "cumulative" | "compounded",
  "cam_cap_percent": number | null,
  "cam_cap_base_amount": number | null,
  "base_year": number | null,
  "base_year_amount": number | null,
  "expense_stop_amount": number | null,
  "expense_stop_per_sf": boolean,
  "has_gross_up": boolean,
  "gross_up_occupancy_threshold": number | null,
  "admin_fee_percent": number | null,
  "excluded_categories": string[],
  "proration_start": "YYYY-MM-DD" | null,
  "proration_end": "YYYY-MM-DD" | null,
  "special_provisions": string | null
}

Notes:
- cam_cap_percent: annual percentage cap (e.g., 5 means 5% per year)
- expense_stop_amount: dollar amount tenant is responsible up to (expense stop / base stop)
- expense_stop_per_sf: true if the stop is expressed per square foot
- gross_up_occupancy_threshold: percentage (e.g., 95 means gross up to 95% occupancy)
- admin_fee_percent: management/admin fee as percentage of CAM (e.g., 15 means 15%)
- excluded_categories should use these values where applicable: property_tax, insurance, utilities_water, utilities_electric, utilities_gas, utilities_trash, maintenance_repair, landscaping, janitorial, security, management_fee, legal, accounting, marketing, capital_improvement, pest_control, hvac, roof_repair, parking_lot, signage

LEASE DOCUMENT TEXT:
${document_text}`;

    const response = await callClaude({ prompt, maxTokens: 2048 });
    const extracted = parseClaudeJSON<any>(response.content);

    // Auto-save lease terms to tenant_lease_terms
    const leaseTermsPayload: Record<string, any> = {
      tenant_id,
      cam_cap_type: extracted.cam_cap_type || 'none',
      cam_cap_percent: extracted.cam_cap_percent,
      cam_cap_base_amount: extracted.cam_cap_base_amount,
      base_year: extracted.base_year,
      base_year_amount: extracted.base_year_amount,
      expense_stop_amount: extracted.expense_stop_amount,
      expense_stop_per_sf: extracted.expense_stop_per_sf ?? false,
      has_gross_up: extracted.has_gross_up ?? false,
      gross_up_occupancy_threshold: extracted.gross_up_occupancy_threshold,
      admin_fee_percent: extracted.admin_fee_percent,
      excluded_categories: extracted.excluded_categories || [],
      proration_start: extracted.proration_start,
      proration_end: extracted.proration_end,
      notes: extracted.special_provisions,
      created_by: req.user.id,
    };

    const { data: savedTerms } = await supabaseAdmin
      .from('tenant_lease_terms')
      .upsert(leaseTermsPayload, { onConflict: 'tenant_id' })
      .select()
      .single();

    // Also update tenant record with lease fields if extracted
    const tenantUpdate: Record<string, any> = {};
    if (extracted.lease_type) tenantUpdate.lease_type = extracted.lease_type;
    if (extracted.lease_start) tenantUpdate.lease_start = extracted.lease_start;
    if (extracted.lease_end) tenantUpdate.lease_end = extracted.lease_end;
    if (extracted.leased_sf) tenantUpdate.leased_sf = extracted.leased_sf;
    if (extracted.monthly_base_rent) tenantUpdate.monthly_base_rent = extracted.monthly_base_rent;

    if (Object.keys(tenantUpdate).length > 0) {
      await supabaseAdmin.from('tenants').update(tenantUpdate).eq('id', tenant_id);
    }

    res.json({
      success: true,
      extracted,
      lease_terms: savedTerms,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    console.error('[CAM] Extract lease terms error:', error);
    res.status(500).json({ success: false, error: 'Failed to extract lease terms' });
  }
};

// ============================================================================
// Report generation — structured JSON (or HTML for PDF)
// ============================================================================
export const getCamReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;

    // Load reconciliation with items + tenant info
    const { data: recon } = await supabaseAdmin.from('cam_reconciliations')
      .select('*, cam_reconciliation_items(*, tenants(tenant_name, unit_number, leased_sf))')
      .eq('id', id).single();
    if (!recon) throw new AppError(404, 'Reconciliation not found');

    // Load property info
    const { data: property } = await supabaseAdmin.from('master_properties')
      .select('address, city, state, zip, building_size')
      .eq('id', recon.master_property_id).single();

    // Load expense breakdown
    const { data: expenses } = await supabaseAdmin.from('operating_expenses')
      .select('category, amount')
      .eq('master_property_id', recon.master_property_id)
      .eq('is_cam_recoverable', true)
      .gte('expense_date', recon.period_start)
      .lte('expense_date', recon.period_end);

    const categoryTotals: Record<string, number> = {};
    for (const e of (expenses || [])) {
      const cat = e.category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    }

    const CATEGORY_LABELS: Record<string, string> = {
      property_tax: 'Property Tax', insurance: 'Insurance',
      utilities_water: 'Water', utilities_electric: 'Electric',
      utilities_gas: 'Gas', utilities_trash: 'Trash',
      maintenance_repair: 'Maintenance & Repair', landscaping: 'Landscaping',
      janitorial: 'Janitorial', security: 'Security',
      management_fee: 'Management Fee', legal: 'Legal',
      accounting: 'Accounting', marketing: 'Marketing',
      capital_improvement: 'Capital Improvement', pest_control: 'Pest Control',
      hvac: 'HVAC', roof_repair: 'Roof Repair',
      parking_lot: 'Parking Lot', signage: 'Signage', other: 'Other',
    };

    const expenseBreakdown = Object.entries(categoryTotals)
      .map(([cat, total]) => ({ category: cat, label: CATEGORY_LABELS[cat] || cat, total }))
      .sort((a, b) => b.total - a.total);

    const items = (recon.cam_reconciliation_items || []).map((item: any) => ({
      tenant_name: item.tenants?.tenant_name || 'Unknown',
      unit_number: item.tenants?.unit_number || '-',
      leased_sf: item.tenants?.leased_sf || 0,
      share_percent: item.share_percent,
      pre_cap_amount: item.pre_cap_amount,
      excluded_amount: item.excluded_amount,
      admin_fee: item.admin_fee,
      base_year_credit: item.base_year_credit,
      expense_stop_credit: item.expense_stop_credit,
      cam_cap_applied: item.cam_cap_applied,
      proration_factor: item.proration_factor,
      gross_up_amount: item.gross_up_amount,
      allocated_amount: item.allocated_amount,
      amount_paid: item.amount_paid,
      balance_due: item.balance_due,
    }));

    const report = {
      property: property || {},
      reconciliation: {
        id: recon.id,
        period: recon.period,
        period_start: recon.period_start,
        period_end: recon.period_end,
        allocation_method: recon.allocation_method,
        is_finalized: recon.is_finalized,
        total_cam_expenses: recon.total_cam_expenses,
        total_gross_up: recon.total_gross_up,
        grossed_up_total: recon.grossed_up_total,
        building_total_sf: recon.building_total_sf,
        total_collected: recon.total_collected,
        variance: recon.variance,
      },
      expense_breakdown: expenseBreakdown,
      tenant_allocations: items,
      generated_at: new Date().toISOString(),
    };

    res.json({ success: true, report });
  } catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, error: error.message }); return; }
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
};
