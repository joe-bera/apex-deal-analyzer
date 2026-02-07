import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { TaskPlaybook, PlaybookTask } from '../types';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';

const DEAL_TYPES = [
  { value: '', label: 'Universal' },
  { value: 'sale', label: 'Sale' },
  { value: 'lease', label: 'Lease' },
  { value: 'listing', label: 'Listing' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'disposition', label: 'Disposition' },
];

export default function Playbooks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<TaskPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create playbook form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', deal_type: '' });
  const [creating, setCreating] = useState(false);

  // Expanded playbook (detail view)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPlaybook, setExpandedPlaybook] = useState<TaskPlaybook | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add task form
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', stage: '', due_offset_days: '', is_required: false });

  const loadPlaybooks = async () => {
    try {
      const res = await api.listPlaybooks();
      setPlaybooks(res.playbooks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybookDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.getPlaybook(id);
      setExpandedPlaybook(res.playbook);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbook');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedPlaybook(null);
      setShowAddTask(false);
    } else {
      setExpandedId(id);
      loadPlaybookDetail(id);
      setShowAddTask(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name) return;
    setCreating(true);
    try {
      await api.createPlaybook({
        name: createForm.name,
        description: createForm.description || undefined,
        deal_type: createForm.deal_type || undefined,
      });
      setCreateForm({ name: '', description: '', deal_type: '' });
      setShowCreate(false);
      await loadPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playbook');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaybook = async (id: string) => {
    if (!confirm('Delete this playbook and all its tasks?')) return;
    try {
      await api.deletePlaybook(id);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedPlaybook(null);
      }
      await loadPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId || !taskForm.title) return;
    try {
      await api.addPlaybookTask(expandedId, {
        title: taskForm.title,
        description: taskForm.description || undefined,
        stage: taskForm.stage || undefined,
        due_offset_days: taskForm.due_offset_days ? parseInt(taskForm.due_offset_days) : undefined,
        is_required: taskForm.is_required,
        sort_order: (expandedPlaybook?.tasks?.length || 0) + 1,
      });
      setTaskForm({ title: '', description: '', stage: '', due_offset_days: '', is_required: false });
      setShowAddTask(false);
      await loadPlaybookDetail(expandedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!expandedId || !confirm('Delete this task?')) return;
    try {
      await api.deletePlaybookTask(expandedId, taskId);
      await loadPlaybookDetail(expandedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Task Playbooks</h1>
              <p className="text-sm text-gray-500 mt-1">Manage reusable task checklists for deal types</p>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'Cancel' : '+ New Playbook'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Create Form */}
        {showCreate && (
          <Card>
            <CardHeader><CardTitle>New Playbook</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input
                      required
                      value={createForm.name}
                      onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="e.g., Sale Transaction Checklist"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Deal Type</label>
                    <select
                      value={createForm.deal_type}
                      onChange={e => setCreateForm(f => ({ ...f, deal_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      value={createForm.description}
                      onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Brief description"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Playbook'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Playbooks List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : !playbooks.length ? (
          <Card>
            <CardContent>
              <p className="text-gray-500 text-sm text-center py-8">No playbooks yet. Create your first one above.</p>
            </CardContent>
          </Card>
        ) : (
          playbooks.map(pb => (
            <Card key={pb.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleToggleExpand(pb.id)}>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === pb.id ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div>
                      <CardTitle>{pb.name}</CardTitle>
                      {pb.description && <p className="text-xs text-gray-500 mt-0.5">{pb.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pb.deal_type && <Badge size="sm">{pb.deal_type}</Badge>}
                    {pb.is_default && <Badge size="sm" variant="info">Default</Badge>}
                    <button
                      onClick={() => handleDeletePlaybook(pb.id)}
                      className="text-gray-400 hover:text-red-500 ml-2"
                      title="Delete playbook"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded Detail */}
              {expandedId === pb.id && (
                <CardContent>
                  {loadingDetail ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Tasks ({expandedPlaybook?.tasks?.length || 0})
                        </span>
                        <Button size="sm" variant="outline" onClick={() => setShowAddTask(!showAddTask)}>
                          {showAddTask ? 'Cancel' : '+ Add Task'}
                        </Button>
                      </div>

                      {/* Add task form */}
                      {showAddTask && (
                        <form onSubmit={handleAddTask} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <input
                                required
                                value={taskForm.title}
                                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Task title *"
                              />
                            </div>
                            <div>
                              <input
                                value={taskForm.stage}
                                onChange={e => setTaskForm(f => ({ ...f, stage: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Stage (e.g., due_diligence)"
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                value={taskForm.due_offset_days}
                                onChange={e => setTaskForm(f => ({ ...f, due_offset_days: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Due offset (days)"
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                value={taskForm.description}
                                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Description"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={taskForm.is_required}
                                onChange={e => setTaskForm(f => ({ ...f, is_required: e.target.checked }))}
                                className="rounded"
                              />
                              Required
                            </label>
                            <Button type="submit" size="sm">Add</Button>
                          </div>
                        </form>
                      )}

                      {/* Task list */}
                      {!expandedPlaybook?.tasks?.length ? (
                        <p className="text-gray-500 text-sm text-center py-4">No tasks in this playbook yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {expandedPlaybook.tasks.map((task: PlaybookTask, idx: number) => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                              <span className="text-xs text-gray-400 w-6 text-center">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">{task.title}</span>
                                  {task.is_required && <span className="text-xs text-red-500">Required</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {task.stage && <span className="text-xs text-gray-500">Stage: {task.stage}</span>}
                                  {task.due_offset_days != null && (
                                    <span className="text-xs text-gray-400">+{task.due_offset_days} days</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-gray-300 hover:text-red-500"
                                title="Delete task"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
