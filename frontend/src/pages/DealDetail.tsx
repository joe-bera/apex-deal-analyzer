import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { CrmDeal, CrmDealType, DealStage, DealPriority, Activity, ActivityType, DealContactLink, DealStageHistoryEntry } from '../types';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';

const STAGES: { value: DealStage; label: string }[] = [
  { value: 'prospecting', label: 'Prospecting' }, { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' }, { value: 'negotiation', label: 'Negotiation' },
  { value: 'under_contract', label: 'Under Contract' }, { value: 'due_diligence', label: 'Due Diligence' },
  { value: 'closing', label: 'Closing' }, { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const DEAL_TYPES: { value: CrmDealType; label: string }[] = [
  { value: 'sale', label: 'Sale' }, { value: 'lease', label: 'Lease' },
  { value: 'listing', label: 'Listing' }, { value: 'acquisition', label: 'Acquisition' },
  { value: 'disposition', label: 'Disposition' },
];

const PRIORITIES: { value: DealPriority; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Call' }, { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' }, { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' }, { value: 'site_visit', label: 'Site Visit' },
  { value: 'other', label: 'Other' },
];

const stageBadgeVariant = (stage: DealStage) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'error' | 'primary' | 'default'> = {
    prospecting: 'default', qualification: 'info', proposal: 'info',
    negotiation: 'warning', under_contract: 'primary', due_diligence: 'warning',
    closing: 'primary', closed_won: 'success', closed_lost: 'error',
  };
  return map[stage] || 'default';
};

const formatCurrency = (v?: number) => {
  if (!v) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
};

const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '-';
const formatDateTime = (d?: string) => d ? new Date(d).toLocaleString() : '-';

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<CrmDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CrmDeal>>({});
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'note' as ActivityType, subject: '', description: '',
  });
  const [stageChangeNotes, setStageChangeNotes] = useState('');
  const [showStageModal, setShowStageModal] = useState(false);
  const [newStage, setNewStage] = useState<DealStage>('prospecting');

  const reload = async () => {
    if (!id) return;
    try {
      const res = await api.getCrmDeal(id);
      setDeal(res.deal);
      setForm(res.deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deal');
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { assigned_user, contacts, activities, stage_history, created_at, updated_at, created_by, id: _, is_deleted, stage_entered_at, ...updates } = form as any;
      await api.updateCrmDeal(id, updates);
      await reload();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this deal?')) return;
    try {
      await api.deleteCrmDeal(id);
      navigate('/crm/deals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleStageChange = async () => {
    if (!id) return;
    try {
      await api.updateCrmDealStage(id, newStage, stageChangeNotes || undefined);
      setShowStageModal(false);
      setStageChangeNotes('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stage');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api.createActivity({ ...activityForm, deal_id: id });
      setShowActivityModal(false);
      setActivityForm({ activity_type: 'note', subject: '', description: '' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add activity');
    }
  };

  const handleRemoveContact = async (dcId: string) => {
    if (!id || !confirm('Remove this contact from the deal?')) return;
    try {
      await api.removeDealContact(id, dcId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove contact');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">{error || 'Deal not found'}</p>
          <Button className="mt-4" onClick={() => navigate('/crm/deals')}>Back to Deals</Button>
        </div>
      </div>
    );
  }

  // Find current stage index for the progress bar
  const activeStages = STAGES.filter(s => s.value !== 'closed_lost');
  const currentIdx = activeStages.findIndex(s => s.value === deal.stage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate('/crm/deals')} className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to Deals
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{deal.deal_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={stageBadgeVariant(deal.stage)}>{deal.stage?.replace(/_/g, ' ')}</Badge>
                <Badge>{deal.deal_type}</Badge>
                <span className="text-lg font-semibold text-gray-700 ml-2">{formatCurrency(deal.deal_value)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setNewStage(deal.stage); setShowStageModal(true); }}>
                Move Stage
              </Button>
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => { setEditing(false); setForm(deal); }}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
                  <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:bg-red-50">Delete</Button>
                </>
              )}
            </div>
          </div>

          {/* Stage Progress Bar */}
          {deal.stage !== 'closed_lost' && (
            <div className="mt-4 flex items-center gap-1">
              {activeStages.map((s, idx) => (
                <div
                  key={s.value}
                  className={`h-2 flex-1 rounded-full ${
                    idx <= currentIdx ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Info */}
          <Card>
            <CardHeader><CardTitle>Deal Information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deal Name</label>
                    <input value={form.deal_name || ''} onChange={(e) => setForm(f => ({ ...f, deal_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deal Type</label>
                    <select value={form.deal_type || 'sale'} onChange={(e) => setForm(f => ({ ...f, deal_type: e.target.value as CrmDealType }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={form.priority || 'medium'} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as DealPriority }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value ($)</label>
                    <input type="number" value={form.deal_value || ''} onChange={(e) => setForm(f => ({ ...f, deal_value: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Probability %</label>
                    <input type="number" min="0" max="100" value={form.probability_percent ?? ''} onChange={(e) => setForm(f => ({ ...f, probability_percent: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asking Price</label>
                    <input type="number" value={form.asking_price || ''} onChange={(e) => setForm(f => ({ ...f, asking_price: parseFloat(e.target.value) || undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Offer Price</label>
                    <input type="number" value={form.offer_price || ''} onChange={(e) => setForm(f => ({ ...f, offer_price: parseFloat(e.target.value) || undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close</label>
                    <input type="date" value={form.expected_close_date?.split('T')[0] || ''} onChange={(e) => setForm(f => ({ ...f, expected_close_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
                    <input type="number" step="0.01" value={form.commission_percent || ''} onChange={(e) => setForm(f => ({ ...f, commission_percent: parseFloat(e.target.value) || undefined }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={form.description || ''} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ['Deal Type', deal.deal_type],
                    ['Priority', deal.priority],
                    ['Probability', deal.probability_percent != null ? `${deal.probability_percent}%` : '-'],
                    ['Asking Price', formatCurrency(deal.asking_price)],
                    ['Offer Price', formatCurrency(deal.offer_price)],
                    ['Final Price', formatCurrency(deal.final_price)],
                    ['Commission', deal.commission_percent ? `${deal.commission_percent}%` : '-'],
                    ['Commission Total', formatCurrency(deal.commission_total)],
                    ['Expected Close', formatDate(deal.expected_close_date)],
                    ['Actual Close', formatDate(deal.actual_close_date)],
                    ['Listing Date', formatDate(deal.listing_date)],
                    ['Assigned To', deal.assigned_user?.full_name || '-'],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <dt className="text-sm text-gray-500">{label}</dt>
                      <dd className="text-sm font-medium text-gray-900 mt-0.5">{val || '-'}</dd>
                    </div>
                  ))}
                  {deal.description && (
                    <div className="col-span-2">
                      <dt className="text-sm text-gray-500">Description</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{deal.description}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Activities */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Activities</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowActivityModal(true)}>+ Log Activity</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!deal.activities?.length ? (
                <p className="text-gray-500 text-sm text-center py-6">No activities yet.</p>
              ) : (
                <div className="space-y-3">
                  {deal.activities.map((a: Activity) => (
                    <div key={a.id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                      <div className="mt-0.5 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{a.subject}</span>
                          <Badge size="sm">{a.activity_type?.replace(/_/g, ' ')}</Badge>
                        </div>
                        {a.description && <p className="text-sm text-gray-600 mt-0.5">{a.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(a.activity_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stage History */}
          <Card>
            <CardHeader><CardTitle>Stage History</CardTitle></CardHeader>
            <CardContent>
              {!deal.stage_history?.length ? (
                <p className="text-gray-500 text-sm text-center py-6">No stage changes recorded.</p>
              ) : (
                <div className="space-y-3">
                  {deal.stage_history.map((h: DealStageHistoryEntry) => (
                    <div key={h.id} className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-0">
                      <div className="mt-0.5 w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          {h.from_stage && (
                            <>
                              <Badge size="sm" variant={stageBadgeVariant(h.from_stage)}>{h.from_stage.replace(/_/g, ' ')}</Badge>
                              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </>
                          )}
                          <Badge size="sm" variant={stageBadgeVariant(h.to_stage)}>{h.to_stage.replace(/_/g, ' ')}</Badge>
                        </div>
                        {h.notes && <p className="text-sm text-gray-600 mt-1">{h.notes}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {h.changed_by_user?.full_name || 'System'} &middot; {formatDateTime(h.changed_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contacts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contacts ({deal.contacts?.length || 0})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!deal.contacts?.length ? (
                <p className="text-gray-500 text-sm text-center py-4">No contacts linked.</p>
              ) : (
                <div className="space-y-3">
                  {deal.contacts.map((dc: DealContactLink) => (
                    <div key={dc.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div
                          className="cursor-pointer hover:text-primary-600"
                          onClick={() => dc.contact && navigate(`/crm/contacts/${dc.contact.id}`)}
                        >
                          <p className="font-medium text-sm text-gray-900">
                            {dc.contact?.first_name} {dc.contact?.last_name}
                          </p>
                          {dc.contact?.email && <p className="text-xs text-gray-500">{dc.contact.email}</p>}
                        </div>
                        <button
                          onClick={() => handleRemoveContact(dc.id)}
                          className="text-gray-400 hover:text-red-500"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <Badge size="sm" className="mt-1">{dc.role?.replace(/_/g, ' ')}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Dates */}
          <Card>
            <CardHeader><CardTitle>Key Dates</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {[
                  ['Created', formatDate(deal.created_at)],
                  ['Stage Entered', formatDate(deal.stage_entered_at)],
                  ['Expected Close', formatDate(deal.expected_close_date)],
                  ['Listing Date', formatDate(deal.listing_date)],
                  ['Expiration', formatDate(deal.expiration_date)],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="text-gray-900">{val}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stage Change Modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-6 border-b"><h2 className="text-lg font-semibold">Move Deal Stage</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Stage</label>
                <select value={newStage} onChange={(e) => setNewStage(e.target.value as DealStage)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={stageChangeNotes} onChange={(e) => setStageChangeNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowStageModal(false)}>Cancel</Button>
                <Button onClick={handleStageChange}>Move Stage</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b"><h2 className="text-lg font-semibold">Log Activity</h2></div>
            <form onSubmit={handleAddActivity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={activityForm.activity_type} onChange={(e) => setActivityForm(f => ({ ...f, activity_type: e.target.value as ActivityType }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input required value={activityForm.subject} onChange={(e) => setActivityForm(f => ({ ...f, subject: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={activityForm.description} onChange={(e) => setActivityForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowActivityModal(false)}>Cancel</Button>
                <Button type="submit">Save Activity</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
