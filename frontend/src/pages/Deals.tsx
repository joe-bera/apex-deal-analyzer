import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { CrmDeal, CrmDealType, DealStage, DealPriority, PipelineColumn, DealAnalyticsData } from '../types';
import { Card, CardContent, Button, Badge, EmptyState } from '../components/ui';
import Layout from '../components/Layout';

const DEAL_TYPES: { value: CrmDealType; label: string }[] = [
  { value: 'sale', label: 'Sale' }, { value: 'lease', label: 'Lease' },
  { value: 'listing', label: 'Listing' }, { value: 'acquisition', label: 'Acquisition' },
  { value: 'disposition', label: 'Disposition' },
];

const STAGES: { value: DealStage; label: string }[] = [
  { value: 'prospecting', label: 'Prospecting' }, { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' }, { value: 'negotiation', label: 'Negotiation' },
  { value: 'under_contract', label: 'Under Contract' }, { value: 'due_diligence', label: 'Due Diligence' },
  { value: 'closing', label: 'Closing' }, { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const PRIORITIES: { value: DealPriority; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
];

const stageBadgeVariant = (stage: DealStage) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'error' | 'primary' | 'default'> = {
    prospecting: 'default', qualification: 'info', proposal: 'info',
    negotiation: 'warning', under_contract: 'primary', due_diligence: 'warning',
    closing: 'primary', closed_won: 'success', closed_lost: 'error',
  };
  return map[stage] || 'default';
};

const priorityBadgeVariant = (p: DealPriority) => {
  const map: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
    low: 'default', medium: 'info', high: 'warning', urgent: 'error',
  };
  return map[p] || 'default';
};

const formatCurrency = (v?: number) => {
  if (!v) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
};

type ViewMode = 'list' | 'pipeline';

export default function Deals() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('pipeline');
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [pipeline, setPipeline] = useState<PipelineColumn[]>([]);
  const [analytics, setAnalytics] = useState<DealAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    deal_name: '', deal_type: 'sale' as CrmDealType, stage: 'prospecting' as DealStage,
    deal_value: '', priority: 'medium' as DealPriority, description: '',
    expected_close_date: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === 'pipeline') {
        const [pipeRes, analyticsRes] = await Promise.all([
          api.getCrmDealPipeline(),
          api.getCrmDealAnalytics(),
        ]);
        setPipeline(pipeRes.pipeline || []);
        setAnalytics(analyticsRes.analytics || null);
      } else {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (stageFilter) params.stage = stageFilter;
        const res = await api.listCrmDeals(params);
        setDeals(res.deals || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [view, search, stageFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.deal_value) payload.deal_value = parseFloat(payload.deal_value);
      else delete payload.deal_value;
      if (!payload.expected_close_date) delete payload.expected_close_date;
      if (!payload.description) delete payload.description;
      await api.createCrmDeal(payload);
      setShowModal(false);
      setForm({ deal_name: '', deal_type: 'sale', stage: 'prospecting', deal_value: '', priority: 'medium', description: '', expected_close_date: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
              <p className="text-gray-500 mt-1">Manage your deal pipeline</p>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setView('pipeline')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'pipeline' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Pipeline
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  List
                </button>
              </div>
              <Button onClick={() => setShowModal(true)}>+ New Deal</Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
        </div>
      )}

      {/* Analytics cards */}
      {view === 'pipeline' && analytics && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Active Deals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.active_deals}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(analytics.total_pipeline_value)}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Win Rate</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{analytics.win_rate}%</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Commission Earned</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(analytics.total_commission_earned)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            <p className="text-gray-500 mt-2">Loading deals...</p>
          </div>
        ) : view === 'pipeline' ? (
          /* Pipeline / Kanban View */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pipeline.map((col) => (
              <div key={col.stage} className="flex-shrink-0 w-72">
                <div className="bg-gray-100 rounded-t-lg px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-700 capitalize">
                      {col.stage.replace(/_/g, ' ')}
                    </h3>
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{col.count}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatCurrency(col.total_value)}</span>
                </div>
                <div className="bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-[100px]">
                  {col.deals.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No deals</p>
                  ) : (
                    col.deals.map((deal: CrmDeal) => (
                      <div
                        key={deal.id}
                        className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => navigate(`/crm/deals/${deal.id}`)}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">{deal.deal_name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge size="sm" variant={priorityBadgeVariant(deal.priority)}>{deal.priority}</Badge>
                          <span className="text-sm font-semibold text-gray-700">{formatCurrency(deal.deal_value)}</span>
                        </div>
                        {deal.expected_close_date && (
                          <p className="text-xs text-gray-400 mt-1">
                            Close: {new Date(deal.expected_close_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <form onSubmit={(e) => { e.preventDefault(); fetchData(); }} className="flex gap-2 flex-1 min-w-[280px]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deals..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <Button type="submit" variant="outline" size="sm">Search</Button>
              </form>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <Card>
              <CardContent className="p-0">
                {deals.length === 0 ? (
                  <EmptyState
                    title="No deals found"
                    description="Create your first deal to start tracking your pipeline."
                    action={{ label: 'New Deal', onClick: () => setShowModal(true) }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Deal Name</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Stage</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Priority</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Value</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Expected Close</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Assigned To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {deals.map((deal) => (
                          <tr
                            key={deal.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/crm/deals/${deal.id}`)}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">{deal.deal_name}</td>
                            <td className="px-4 py-3">
                              <Badge>{deal.deal_type}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={stageBadgeVariant(deal.stage)}>
                                {deal.stage?.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={priorityBadgeVariant(deal.priority)}>{deal.priority}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(deal.deal_value)}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {deal.assigned_user?.full_name || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* New Deal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-lg font-semibold">New Deal</h2></div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Name *</label>
                <input required value={form.deal_name} onChange={(e) => setForm(f => ({ ...f, deal_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Type</label>
                  <select value={form.deal_type} onChange={(e) => setForm(f => ({ ...f, deal_type: e.target.value as CrmDealType }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select value={form.stage} onChange={(e) => setForm(f => ({ ...f, stage: e.target.value as DealStage }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value ($)</label>
                  <input type="number" value={form.deal_value} onChange={(e) => setForm(f => ({ ...f, deal_value: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as DealPriority }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close Date</label>
                <input type="date" value={form.expected_close_date} onChange={(e) => setForm(f => ({ ...f, expected_close_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Deal'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
