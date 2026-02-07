import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  CrmDeal, CrmDealType, DealStage, DealPriority, Activity, ActivityType,
  DealContactLink, DealStageHistoryEntry, DealRoomDocument, DealRoomInvite,
  DealRoomActivityEntry, DealTask, TaskPlaybook, DealRoomDocumentCategory,
} from '../types';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';

type DealTab = 'overview' | 'deal-room' | 'tasks';

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

const DOC_CATEGORIES: { value: DealRoomDocumentCategory; label: string }[] = [
  { value: 'loi', label: 'LOI' }, { value: 'psa', label: 'PSA' },
  { value: 'title', label: 'Title' }, { value: 'environmental', label: 'Environmental' },
  { value: 'appraisal', label: 'Appraisal' }, { value: 'lease', label: 'Lease' },
  { value: 'financial', label: 'Financial' }, { value: 'other', label: 'Other' },
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
const formatFileSize = (bytes?: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DealTab>('overview');
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

  // Deal Room state
  const [roomDocs, setRoomDocs] = useState<DealRoomDocument[]>([]);
  const [roomInvites, setRoomInvites] = useState<DealRoomInvite[]>([]);
  const [roomActivity, setRoomActivity] = useState<DealRoomActivityEntry[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DealRoomDocumentCategory>('other');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', expires_in_days: 30 });
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Tasks state
  const [dealTasks, setDealTasks] = useState<DealTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [playbooks, setPlaybooks] = useState<TaskPlaybook[]>([]);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState('');
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ title: '', description: '', stage: '', due_date: '' });

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getCrmDeal(id);
      setDeal(res.deal);
      setForm(res.deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deal');
    }
  }, [id]);

  const loadDealRoom = useCallback(async () => {
    if (!id) return;
    setRoomLoading(true);
    try {
      const res = await api.getDealRoom(id);
      setRoomDocs(res.documents || []);
      setRoomInvites(res.invites || []);
      setRoomActivity(res.activity || []);
    } catch (err) {
      console.error('Failed to load deal room:', err);
    } finally {
      setRoomLoading(false);
    }
  }, [id]);

  const loadTasks = useCallback(async () => {
    if (!id) return;
    setTasksLoading(true);
    try {
      const res = await api.listDealTasks(id);
      setDealTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [id, reload]);

  useEffect(() => {
    if (activeTab === 'deal-room') loadDealRoom();
    if (activeTab === 'tasks') loadTasks();
  }, [activeTab, loadDealRoom, loadTasks]);

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

  // Deal Room handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingFile(true);
    try {
      await api.uploadDealRoomFile(id, file, uploadCategory);
      await loadDealRoom();
      setUploadCategory('other');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id || !confirm('Delete this document?')) return;
    try {
      await api.deleteDealRoomDocument(id, docId);
      await loadDealRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !inviteForm.email) return;
    try {
      await api.createDealRoomInvite(id, inviteForm);
      setInviteForm({ email: '', name: '', expires_in_days: 30 });
      setShowInviteForm(false);
      await loadDealRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!id || !confirm('Revoke this invite?')) return;
    try {
      await api.revokeDealRoomInvite(id, inviteId);
      await loadDealRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/deal-room/${token}`;
    navigator.clipboard.writeText(url);
  };

  // Task handlers
  const handleToggleTask = async (task: DealTask) => {
    if (!id) return;
    try {
      await api.updateDealTask(id, task.id, { is_completed: !task.is_completed });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!id || !confirm('Delete this task?')) return;
    try {
      await api.deleteDealTask(id, taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleApplyPlaybook = async () => {
    if (!id || !selectedPlaybook) return;
    try {
      await api.applyPlaybook(id, selectedPlaybook);
      setShowPlaybookModal(false);
      setSelectedPlaybook('');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply playbook');
    }
  };

  const openPlaybookModal = async () => {
    try {
      const res = await api.listPlaybooks();
      setPlaybooks(res.playbooks || []);
      setShowPlaybookModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTaskForm.title) return;
    try {
      await api.createDealTask(id, {
        title: newTaskForm.title,
        description: newTaskForm.description || undefined,
        stage: newTaskForm.stage || undefined,
        due_date: newTaskForm.due_date || undefined,
      });
      setNewTaskForm({ title: '', description: '', stage: '', due_date: '' });
      setShowAddTaskForm(false);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
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

  const activeStages = STAGES.filter(s => s.value !== 'closed_lost');
  const currentIdx = activeStages.findIndex(s => s.value === deal.stage);

  // Task stats
  const completedTasks = dealTasks.filter(t => t.is_completed).length;
  const totalTasks = dealTasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group tasks by stage
  const tasksByStage = dealTasks.reduce<Record<string, DealTask[]>>((acc, t) => {
    const key = t.stage || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

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

          {/* Tab Navigation */}
          <div className="mt-6 flex gap-1 border-b border-gray-200 -mb-px">
            {[
              { key: 'overview' as DealTab, label: 'Overview' },
              { key: 'deal-room' as DealTab, label: 'Deal Room' },
              { key: 'tasks' as DealTab, label: `Tasks${totalTasks > 0 ? ` (${completedTasks}/${totalTasks})` : ''}` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* OVERVIEW TAB */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                          <div className="cursor-pointer hover:text-primary-600" onClick={() => dc.contact && navigate(`/crm/contacts/${dc.contact.id}`)}>
                            <p className="font-medium text-sm text-gray-900">{dc.contact?.first_name} {dc.contact?.last_name}</p>
                            {dc.contact?.email && <p className="text-xs text-gray-500">{dc.contact.email}</p>}
                          </div>
                          <button onClick={() => handleRemoveContact(dc.id)} className="text-gray-400 hover:text-red-500" title="Remove">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <Badge size="sm" className="mt-1">{dc.role?.replace(/_/g, ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
      )}

      {/* ============================================================ */}
      {/* DEAL ROOM TAB */}
      {/* ============================================================ */}
      {activeTab === 'deal-room' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {roomLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              {/* Upload Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Documents ({roomDocs.length})</CardTitle>
                    <div className="flex items-center gap-2">
                      <select
                        value={uploadCategory}
                        onChange={e => setUploadCategory(e.target.value as DealRoomDocumentCategory)}
                        className="text-sm px-2 py-1.5 border border-gray-300 rounded-lg"
                      >
                        {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                      >
                        {uploadingFile ? 'Uploading...' : '+ Upload File'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!roomDocs.length ? (
                    <p className="text-gray-500 text-sm text-center py-8">No documents uploaded yet. Upload files to share with your team and external parties.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">File</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Category</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Size</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Uploaded</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Visible</th>
                            <th className="text-right py-2 px-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomDocs.map(doc => (
                            <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="truncate max-w-[200px]">{doc.file_name}</span>
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <Badge size="sm">{doc.category?.toUpperCase()}</Badge>
                              </td>
                              <td className="py-2 px-2 text-gray-500">{formatFileSize(doc.file_size)}</td>
                              <td className="py-2 px-2 text-gray-500">{formatDate(doc.created_at)}</td>
                              <td className="py-2 px-2">
                                {doc.is_visible_to_external ? (
                                  <span className="text-green-600 text-xs">External</span>
                                ) : (
                                  <span className="text-gray-400 text-xs">Internal</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <button onClick={() => handleDeleteDoc(doc.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invites Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>External Access ({roomInvites.length})</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setShowInviteForm(!showInviteForm)}>
                      {showInviteForm ? 'Cancel' : '+ Invite'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showInviteForm && (
                    <form onSubmit={handleCreateInvite} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                          <input
                            type="email"
                            required
                            value={inviteForm.email}
                            onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="buyer@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                          <input
                            value={inviteForm.name}
                            onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="John Doe"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Expires in (days)</label>
                          <input
                            type="number"
                            min="1"
                            value={inviteForm.expires_in_days}
                            onChange={e => setInviteForm(f => ({ ...f, expires_in_days: parseInt(e.target.value) || 30 }))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="pt-5">
                          <Button type="submit" size="sm">Send Invite</Button>
                        </div>
                      </div>
                    </form>
                  )}

                  {!roomInvites.length ? (
                    <p className="text-gray-500 text-sm text-center py-4">No invites sent yet. Invite buyers, attorneys, or other external parties.</p>
                  ) : (
                    <div className="space-y-3">
                      {roomInvites.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{inv.name || inv.email}</p>
                            <p className="text-xs text-gray-500">{inv.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {inv.expires_at && (
                                <span className="text-xs text-gray-400">Expires: {formatDate(inv.expires_at)}</span>
                              )}
                              {inv.last_accessed_at && (
                                <span className="text-xs text-green-600">Last viewed: {formatDateTime(inv.last_accessed_at)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyInviteLink(inv.access_token)}
                              className="text-xs text-primary-600 hover:underline"
                              title="Copy link"
                            >
                              Copy Link
                            </button>
                            <button onClick={() => handleRevokeInvite(inv.id)} className="text-gray-400 hover:text-red-500" title="Revoke">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Log */}
              <Card>
                <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  {!roomActivity.length ? (
                    <p className="text-gray-500 text-sm text-center py-4">No activity recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {roomActivity.slice(0, 20).map(a => (
                        <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            a.action === 'uploaded' ? 'bg-green-500' :
                            a.action === 'downloaded' ? 'bg-blue-500' :
                            a.action === 'viewed' ? 'bg-yellow-500' :
                            a.action === 'invited' ? 'bg-purple-500' :
                            'bg-gray-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900">
                              {(a.metadata as any)?.email || (a.metadata as any)?.name || 'User'}{' '}
                              <span className="text-gray-500">{a.action}</span>
                              {(a.metadata as any)?.file_name && (
                                <span className="text-gray-700"> {(a.metadata as any).file_name}</span>
                              )}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(a.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TASKS TAB */}
      {/* ============================================================ */}
      {activeTab === 'tasks' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              {/* Task Progress + Actions */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">
                        {completedTasks}/{totalTasks} tasks completed
                      </span>
                      {totalTasks > 0 && (
                        <span className="text-sm text-gray-500">{taskProgress}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={openPlaybookModal}>Apply Playbook</Button>
                      <Button size="sm" onClick={() => setShowAddTaskForm(!showAddTaskForm)}>
                        {showAddTaskForm ? 'Cancel' : '+ Add Task'}
                      </Button>
                      <button
                        onClick={() => navigate('/playbooks')}
                        className="text-xs text-primary-600 hover:underline ml-2"
                      >
                        Manage Playbooks
                      </button>
                    </div>
                  </div>
                  {totalTasks > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Task Form */}
              {showAddTaskForm && (
                <Card>
                  <CardContent>
                    <form onSubmit={handleAddTask} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Task Title *</label>
                          <input
                            required
                            value={newTaskForm.title}
                            onChange={e => setNewTaskForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="e.g., Review PSA"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                          <select
                            value={newTaskForm.stage}
                            onChange={e => setNewTaskForm(f => ({ ...f, stage: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">No stage</option>
                            {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                          <input
                            type="date"
                            value={newTaskForm.due_date}
                            onChange={e => setNewTaskForm(f => ({ ...f, due_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                          <textarea
                            value={newTaskForm.description}
                            onChange={e => setNewTaskForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" size="sm">Add Task</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Tasks List */}
              {!dealTasks.length ? (
                <Card>
                  <CardContent>
                    <p className="text-gray-500 text-sm text-center py-8">
                      No tasks yet. Apply a playbook or add tasks manually to track deal progress.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(tasksByStage).map(([stage, tasks]) => (
                  <Card key={stage}>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {stage === 'general' ? 'General' : stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        <span className="text-gray-400 font-normal ml-2">({tasks.filter(t => t.is_completed).length}/{tasks.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {tasks.map(task => (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              task.is_completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleTask(task)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                task.is_completed
                                  ? 'bg-primary-500 border-primary-500'
                                  : 'border-gray-300 hover:border-primary-400'
                              }`}
                            >
                              {task.is_completed && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                  {task.title}
                                </span>
                                {task.is_required && (
                                  <span className="text-xs text-red-500 font-medium">Required</span>
                                )}
                              </div>
                              {task.description && (
                                <p className={`text-xs mt-0.5 ${task.is_completed ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                {task.assigned_user && (
                                  <span className="text-xs text-gray-500">
                                    {task.assigned_user.full_name}
                                  </span>
                                )}
                                {task.due_date && (
                                  <span className={`text-xs ${
                                    !task.is_completed && new Date(task.due_date) < new Date()
                                      ? 'text-red-500'
                                      : 'text-gray-400'
                                  }`}>
                                    Due: {formatDate(task.due_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-gray-300 hover:text-red-500 flex-shrink-0"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

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

      {/* Apply Playbook Modal */}
      {showPlaybookModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b"><h2 className="text-lg font-semibold">Apply Playbook</h2></div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Select a playbook template to create tasks for this deal.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Playbook</label>
                <select
                  value={selectedPlaybook}
                  onChange={e => setSelectedPlaybook(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select a playbook...</option>
                  {playbooks.map(pb => (
                    <option key={pb.id} value={pb.id}>
                      {pb.name} {pb.deal_type ? `(${pb.deal_type})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedPlaybook && playbooks.find(p => p.id === selectedPlaybook)?.description && (
                <p className="text-xs text-gray-500">
                  {playbooks.find(p => p.id === selectedPlaybook)?.description}
                </p>
              )}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPlaybookModal(false)}>Cancel</Button>
                <Button onClick={handleApplyPlaybook} disabled={!selectedPlaybook}>Apply</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
