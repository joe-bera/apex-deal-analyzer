import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Contact, ContactType, Activity, ActivityType } from '../types';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';
import Layout from '../components/Layout';

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'owner', label: 'Owner' }, { value: 'tenant', label: 'Tenant' },
  { value: 'buyer', label: 'Buyer' }, { value: 'seller', label: 'Seller' },
  { value: 'broker', label: 'Broker' }, { value: 'lender', label: 'Lender' },
  { value: 'attorney', label: 'Attorney' }, { value: 'property_manager', label: 'Property Manager' },
  { value: 'investor', label: 'Investor' }, { value: 'developer', label: 'Developer' },
  { value: 'appraiser', label: 'Appraiser' }, { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Call' }, { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' }, { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' }, { value: 'site_visit', label: 'Site Visit' },
  { value: 'other', label: 'Other' },
];

const activityIcon = (type: ActivityType) => {
  const icons: Record<string, string> = {
    call: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    meeting: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    task: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    site_visit: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  };
  return icons[type] || icons.note;
};

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'note' as ActivityType, subject: '', description: '',
  });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getContact(id);
        setContact(res.contact);
        setForm(res.contact);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contact');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { company, deals, activities, linked_properties, created_at, updated_at, created_by, id: _, ...updates } = form as any;
      await api.updateContact(id, updates);
      const res = await api.getContact(id);
      setContact(res.contact);
      setForm(res.contact);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this contact?')) return;
    try {
      await api.deleteContact(id);
      navigate('/crm/contacts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api.createActivity({ ...activityForm, contact_id: id });
      setShowActivityModal(false);
      setActivityForm({ activity_type: 'note', subject: '', description: '' });
      const res = await api.getContact(id);
      setContact(res.contact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add activity');
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '-';
  const formatDateTime = (d?: string) => d ? new Date(d).toLocaleString() : '-';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!contact) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-500">{error || 'Contact not found'}</p>
            <Button className="mt-4" onClick={() => navigate('/crm/contacts')}>Back to Contacts</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate('/crm/contacts')} className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to Contacts
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {contact.first_name} {contact.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="info">{contact.contact_type?.replace(/_/g, ' ')}</Badge>
                {contact.company?.name && (
                  <span className="text-gray-500 text-sm">at {contact.company.name}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => { setEditing(false); setForm(contact); }}>Cancel</Button>
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
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input value={form.first_name || ''} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input value={form.last_name || ''} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={form.contact_type || 'other'} onChange={(e) => setForm(f => ({ ...f, contact_type: e.target.value as ContactType }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input value={form.title || ''} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email || ''} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={form.phone || ''} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                    <input value={form.mobile_phone || ''} onChange={(e) => setForm(f => ({ ...f, mobile_phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License #</label>
                    <input value={form.license_number || ''} onChange={(e) => setForm(f => ({ ...f, license_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={form.notes || ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ['Email', contact.email],
                    ['Phone', contact.phone],
                    ['Mobile', contact.mobile_phone],
                    ['Title', contact.title],
                    ['License #', contact.license_number],
                    ['Source', contact.source],
                    ['Last Contacted', formatDate(contact.last_contacted_at)],
                    ['Next Follow-up', formatDate(contact.next_follow_up_at)],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <dt className="text-sm text-gray-500">{label}</dt>
                      <dd className="text-sm font-medium text-gray-900 mt-0.5">{val || '-'}</dd>
                    </div>
                  ))}
                  {contact.notes && (
                    <div className="col-span-2">
                      <dt className="text-sm text-gray-500">Notes</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{contact.notes}</dd>
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
              {!contact.activities?.length ? (
                <p className="text-gray-500 text-sm text-center py-6">No activities recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {contact.activities.map((a: Activity) => (
                    <div key={a.id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                      <div className="mt-0.5 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activityIcon(a.activity_type)} />
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Linked Deals */}
          <Card>
            <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
            <CardContent>
              {!contact.deals?.length ? (
                <p className="text-gray-500 text-sm text-center py-4">No deals linked.</p>
              ) : (
                <div className="space-y-3">
                  {contact.deals.map((dc) => (
                    <div
                      key={dc.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      onClick={() => dc.deal && navigate(`/crm/deals/${dc.deal.id}`)}
                    >
                      <p className="font-medium text-sm text-gray-900">{dc.deal?.deal_name || 'Unknown'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge size="sm">{dc.role?.replace(/_/g, ' ')}</Badge>
                        <Badge size="sm" variant="info">{dc.deal?.stage?.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
            <CardContent>
              {contact.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag, i) => (
                    <Badge key={i} variant="default">{tag}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">No tags</p>
              )}
            </CardContent>
          </Card>

          {/* Meta */}
          <Card>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-gray-900">{formatDate(contact.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="text-gray-900">{formatDate(contact.updated_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b"><h2 className="text-lg font-semibold">Log Activity</h2></div>
            <form onSubmit={handleAddActivity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={activityForm.activity_type}
                  onChange={(e) => setActivityForm(f => ({ ...f, activity_type: e.target.value as ActivityType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
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
    </Layout>
  );
}
