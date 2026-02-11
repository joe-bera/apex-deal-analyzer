import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type {
  CamReconciliation, CamReconciliationItem, CamAllocationMethod,
  ReconciliationPeriod, TenantLeaseTerms, CamCapType, Tenant,
} from '../types';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmt2 = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

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

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

interface Props {
  propertyId: string;
  buildingSize?: number;
}

export default function CamReconciliationTab({ propertyId, buildingSize }: Props) {
  const [reconciliations, setReconciliations] = useState<CamReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CamReconciliation | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLeaseTerms, setShowLeaseTerms] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);

  const fetchReconciliations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listCamReconciliations({ property_id: propertyId });
      setReconciliations(res.reconciliations || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchReconciliations(); }, [fetchReconciliations]);

  const loadDetail = async (id: string) => {
    try {
      const [reconRes, breakdownRes] = await Promise.all([
        api.getCamReconciliation(id),
        api.getCamExpenseBreakdown(id),
      ]);
      setSelected(reconRes.reconciliation);
      setExpenseBreakdown(breakdownRes.breakdown || []);
    } catch (err) { console.error(err); }
  };

  const handleCalculate = async () => {
    if (!selected) return;
    setCalculating(true);
    try {
      await api.calculateCamReconciliation(selected.id);
      await loadDetail(selected.id);
      fetchReconciliations();
    } catch (err) { console.error(err); } finally { setCalculating(false); }
  };

  const handleFinalize = async () => {
    if (!selected || !confirm('Finalize this reconciliation? This cannot be undone.')) return;
    try {
      await api.finalizeCamReconciliation(selected.id);
      await loadDetail(selected.id);
      fetchReconciliations();
    } catch (err) { console.error(err); }
  };

  const handleExport = async () => {
    if (!selected) return;
    try {
      const res = await api.getCamReport(selected.id);
      const blob = new Blob([JSON.stringify(res.report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cam-reconciliation-${selected.period_start}-${selected.period_end}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const openLeaseTerms = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setShowLeaseTerms(true);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading CAM reconciliations...</div>;

  // Detail view
  if (selected) {
    const items = selected.cam_reconciliation_items || selected.items || [];
    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to List
          </button>
          <div className="flex gap-2">
            {!selected.is_finalized && (
              <button onClick={handleCalculate} disabled={calculating} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {calculating ? 'Calculating...' : 'Calculate'}
              </button>
            )}
            {!selected.is_finalized && items.length > 0 && (
              <button onClick={handleFinalize} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                Finalize
              </button>
            )}
            {items.length > 0 && (
              <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Export Report
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Period" value={`${selected.period_start} to ${selected.period_end}`} />
          <SummaryCard label="Total CAM Expenses" value={fmt(selected.total_cam_expenses || 0)} color="text-red-600" />
          <SummaryCard label="Grossed-Up Total" value={selected.grossed_up_total ? fmt(selected.grossed_up_total) : '-'} />
          <SummaryCard label="Status" value={selected.is_finalized ? 'Finalized' : 'Draft'} color={selected.is_finalized ? 'text-green-600' : 'text-yellow-600'} />
        </div>
        {(selected.total_gross_up || 0) > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
            Gross-up adjustment: {fmt2(selected.total_gross_up || 0)} (building at {selected.building_total_sf ? `${Math.round((items.reduce((s, i) => s + ((i.tenants?.leased_sf || i.tenant?.leased_sf) || 0), 0) / selected.building_total_sf) * 100)}%` : '?'} occupancy)
          </div>
        )}

        {/* Expense Breakdown */}
        {expenseBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Expense Breakdown by Category</h3>
            <div className="space-y-2">
              {expenseBreakdown.map((cat: any) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-primary-500 h-full rounded-full" style={{ width: `${Math.min(cat.percent_of_total, 100)}%` }} />
                    </div>
                    <span className="text-sm text-gray-700">{CATEGORY_LABELS[cat.category] || cat.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{cat.percent_of_total.toFixed(1)}%</span>
                    <span className="text-sm font-medium text-gray-900 w-24 text-right">{fmt2(cat.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tenant Allocation Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider px-6 py-4 border-b">Tenant Allocations</h3>
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No allocations yet. Click "Calculate" to generate.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs">Tenant</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">SF</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Share</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Pre-Cap</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Exclusions</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Admin Fee</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Base Yr Cr</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Exp Stop Cr</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Cap Adj</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Proration</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Final</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Paid</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-500 uppercase text-xs">Balance</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-500 uppercase text-xs">Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item: CamReconciliationItem) => {
                    const tName = item.tenants?.tenant_name || item.tenant?.tenant_name || 'Unknown';
                    const tUnit = item.tenants?.unit_number || item.tenant?.unit_number || '-';
                    const tSf = item.tenants?.leased_sf || item.tenant?.leased_sf || 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{tName}</div>
                          <div className="text-xs text-gray-500">{tUnit}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{tSf ? tSf.toLocaleString() : '-'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.share_percent ? fmtPct(item.share_percent) : '-'}</td>
                        <td className="px-3 py-3 text-right text-gray-900">{item.pre_cap_amount ? fmt2(item.pre_cap_amount) : '-'}</td>
                        <td className="px-3 py-3 text-right text-red-600">{item.excluded_amount ? `-${fmt2(item.excluded_amount)}` : '-'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.admin_fee ? fmt2(item.admin_fee) : '-'}</td>
                        <td className="px-3 py-3 text-right text-green-600">{item.base_year_credit ? `-${fmt2(item.base_year_credit)}` : '-'}</td>
                        <td className="px-3 py-3 text-right text-green-600">{item.expense_stop_credit ? `-${fmt2(item.expense_stop_credit)}` : '-'}</td>
                        <td className="px-3 py-3 text-right text-orange-600">{item.cam_cap_applied ? `-${fmt2(item.cam_cap_applied)}` : '-'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.proration_factor != null && item.proration_factor < 1 ? `${(item.proration_factor * 100).toFixed(1)}%` : '100%'}</td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmt2(item.allocated_amount || 0)}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{fmt2(item.amount_paid || 0)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmt2(item.balance_due || 0)}</td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => openLeaseTerms(item.tenant_id)} className="text-primary-600 hover:text-primary-700 text-xs hover:underline">
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={10} className="px-4 py-3 text-sm font-semibold text-gray-900">Totals</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">{fmt2(items.reduce((s, i) => s + (i.allocated_amount || 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-600">{fmt2(items.reduce((s, i) => s + (i.amount_paid || 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">{fmt2(items.reduce((s, i) => s + (i.balance_due || 0), 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Lease Terms Modal */}
        {showLeaseTerms && selectedTenantId && (
          <LeaseTermsModal
            tenantId={selectedTenantId}
            onClose={() => { setShowLeaseTerms(false); setSelectedTenantId(null); }}
            onSaved={() => { if (selected) loadDetail(selected.id); }}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">CAM Reconciliations</h3>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Reconciliation
        </button>
      </div>

      {reconciliations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No CAM reconciliations yet.</p>
          <p className="text-sm text-gray-400 mt-1">Create one to start allocating expenses to tenants.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dates</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total CAM</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Allocated</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reconciliations.map(r => (
                <tr key={r.id} onClick={() => loadDetail(r.id)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{r.period || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.period_start} &mdash; {r.period_end}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{r.total_cam_expenses ? fmt(r.total_cam_expenses) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{r.variance ? fmt(r.variance) : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.is_finalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.is_finalized ? 'Finalized' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Reconciliation Modal */}
      {showCreate && (
        <CreateReconciliationModal
          propertyId={propertyId}
          onClose={() => setShowCreate(false)}
          onCreated={(r) => { setShowCreate(false); fetchReconciliations(); loadDetail(r.id); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Summary Card
// ============================================================================
function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

// ============================================================================
// Create Reconciliation Modal
// ============================================================================
function CreateReconciliationModal({ propertyId, onClose, onCreated }: {
  propertyId: string;
  onClose: () => void;
  onCreated: (r: CamReconciliation) => void;
}) {
  const [form, setForm] = useState({
    period: 'annual' as ReconciliationPeriod,
    period_start: '',
    period_end: '',
    allocation_method: 'pro_rata_sf' as CamAllocationMethod,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.createCamReconciliation({
        master_property_id: propertyId,
        ...form,
      });
      onCreated(res.reconciliation);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New CAM Reconciliation</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
            <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value as ReconciliationPeriod }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" required value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input type="date" required value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allocation Method</label>
            <select value={form.allocation_method} onChange={e => setForm(f => ({ ...f, allocation_method: e.target.value as CamAllocationMethod }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="pro_rata_sf">Pro-Rata (by SF)</option>
              <option value="equal_share">Equal Share</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Lease Terms Modal
// ============================================================================
function LeaseTermsModal({ tenantId, onClose, onSaved }: {
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractText, setExtractText] = useState('');
  const [showExtract, setShowExtract] = useState(false);
  const [form, setForm] = useState<TenantLeaseTerms>({
    tenant_id: tenantId,
    cam_cap_type: 'none',
    expense_stop_per_sf: false,
    has_gross_up: false,
    excluded_categories: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getLeaseTerms(tenantId);
        if (res.lease_terms) {
          setForm({ ...form, ...res.lease_terms });
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    })();
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.upsertLeaseTerms(tenantId, form);
      onSaved();
      onClose();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const handleExtract = async () => {
    if (!extractText.trim()) return;
    setExtracting(true);
    try {
      const res = await api.extractLeaseTerms({ tenant_id: tenantId, document_text: extractText });
      if (res.lease_terms) {
        setForm(prev => ({ ...prev, ...res.lease_terms }));
      }
      setShowExtract(false);
      setExtractText('');
    } catch (err) { console.error(err); } finally { setExtracting(false); }
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      excluded_categories: prev.excluded_categories.includes(cat)
        ? prev.excluded_categories.filter(c => c !== cat)
        : [...prev.excluded_categories, cat],
    }));
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 text-center text-gray-500">Loading...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lease Terms — CAM Provisions</h2>
            <button onClick={() => setShowExtract(!showExtract)} className="text-sm text-primary-600 hover:underline">
              {showExtract ? 'Hide' : 'Extract from Lease'}
            </button>
          </div>

          {/* AI Extract Panel */}
          {showExtract && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-2">Paste lease text below to auto-extract CAM terms using AI.</p>
              <textarea
                rows={6}
                value={extractText}
                onChange={e => setExtractText(e.target.value)}
                placeholder="Paste lease document text here..."
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm mb-2"
              />
              <button
                onClick={handleExtract}
                disabled={extracting || !extractText.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {extracting ? 'Extracting...' : 'Extract Terms'}
              </button>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            {/* CAM Cap */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-medium text-gray-700 px-2">CAM Cap</legend>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cap Type</label>
                  <select value={form.cam_cap_type} onChange={e => setForm(f => ({ ...f, cam_cap_type: e.target.value as CamCapType }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="none">None</option>
                    <option value="cumulative">Cumulative</option>
                    <option value="compounded">Compounded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cap % / Year</label>
                  <input type="number" step="0.01" value={form.cam_cap_percent ?? ''} onChange={e => setForm(f => ({ ...f, cam_cap_percent: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 5.00" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cap Base Amount</label>
                  <input type="number" step="0.01" value={form.cam_cap_base_amount ?? ''} onChange={e => setForm(f => ({ ...f, cam_cap_base_amount: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </fieldset>

            {/* Base Year */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-medium text-gray-700 px-2">Base Year</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Base Year</label>
                  <input type="number" value={form.base_year ?? ''} onChange={e => setForm(f => ({ ...f, base_year: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 2024" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Base Year CAM Amount</label>
                  <input type="number" step="0.01" value={form.base_year_amount ?? ''} onChange={e => setForm(f => ({ ...f, base_year_amount: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </fieldset>

            {/* Expense Stop */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-medium text-gray-700 px-2">Expense Stop</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stop Amount</label>
                  <input type="number" step="0.01" value={form.expense_stop_amount ?? ''} onChange={e => setForm(f => ({ ...f, expense_stop_amount: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.expense_stop_per_sf} onChange={e => setForm(f => ({ ...f, expense_stop_per_sf: e.target.checked }))} className="rounded border-gray-300" />
                    Per Square Foot
                  </label>
                </div>
              </div>
            </fieldset>

            {/* Gross-Up + Admin Fee */}
            <div className="grid grid-cols-2 gap-4">
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">Gross-Up</legend>
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input type="checkbox" checked={form.has_gross_up} onChange={e => setForm(f => ({ ...f, has_gross_up: e.target.checked }))} className="rounded border-gray-300" />
                  Has Gross-Up Provision
                </label>
                {form.has_gross_up && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Occupancy Threshold %</label>
                    <input type="number" step="0.01" value={form.gross_up_occupancy_threshold ?? ''} onChange={e => setForm(f => ({ ...f, gross_up_occupancy_threshold: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 95" />
                  </div>
                )}
              </fieldset>
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">Admin Fee</legend>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Admin/Mgmt Fee %</label>
                  <input type="number" step="0.01" value={form.admin_fee_percent ?? ''} onChange={e => setForm(f => ({ ...f, admin_fee_percent: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 15" />
                </div>
              </fieldset>
            </div>

            {/* Proration */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-medium text-gray-700 px-2">Proration</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Occupancy Start</label>
                  <input type="date" value={form.proration_start ?? ''} onChange={e => setForm(f => ({ ...f, proration_start: e.target.value || undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Occupancy End</label>
                  <input type="date" value={form.proration_end ?? ''} onChange={e => setForm(f => ({ ...f, proration_end: e.target.value || undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </fieldset>

            {/* Excluded Categories */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-sm font-medium text-gray-700 px-2">Excluded Expense Categories</legend>
              <p className="text-xs text-gray-500 mb-3">Select categories this tenant is excluded from paying.</p>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      form.excluded_categories.includes(cat)
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Terms'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
