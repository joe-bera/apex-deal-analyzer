import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Company, CompanyType } from '../types';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';
import Layout from '../components/Layout';

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'brokerage', label: 'Brokerage' }, { value: 'investment_firm', label: 'Investment Firm' },
  { value: 'developer', label: 'Developer' }, { value: 'tenant_company', label: 'Tenant Company' },
  { value: 'lender', label: 'Lender' }, { value: 'law_firm', label: 'Law Firm' },
  { value: 'management_company', label: 'Management Company' }, { value: 'construction', label: 'Construction' },
  { value: 'appraisal_firm', label: 'Appraisal Firm' }, { value: 'title_company', label: 'Title Company' },
  { value: 'other', label: 'Other' },
];

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Company>>({});

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getCompany(id);
        setCompany(res.company);
        setForm(res.company);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company');
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
      const { contacts, created_at, updated_at, created_by, id: _, is_deleted, ...updates } = form as any;
      await api.updateCompany(id, updates);
      const res = await api.getCompany(id);
      setCompany(res.company);
      setForm(res.company);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this company?')) return;
    try {
      await api.deleteCompany(id);
      navigate('/crm/companies');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '-';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-500">{error || 'Company not found'}</p>
            <Button className="mt-4" onClick={() => navigate('/crm/companies')}>Back to Companies</Button>
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
              <button onClick={() => navigate('/crm/companies')} className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to Companies
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <Badge variant="info" className="mt-1">{company.company_type?.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => { setEditing(false); setForm(company); }}>Cancel</Button>
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
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input value={form.name || ''} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={form.company_type || 'other'} onChange={(e) => setForm(f => ({ ...f, company_type: e.target.value as CompanyType }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {COMPANY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <input value={(form as any).industry || ''} onChange={(e) => setForm(f => ({ ...f, industry: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={form.phone || ''} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email || ''} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input value={(form as any).website || ''} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input value={(form as any).address || ''} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input value={(form as any).city || ''} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input value={(form as any).state || ''} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={form.notes || ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ['Industry', (company as any).industry],
                    ['Phone', company.phone],
                    ['Email', company.email],
                    ['Website', (company as any).website],
                    ['Address', (company as any).address],
                    ['Location', company.city && company.state ? `${company.city}, ${company.state} ${company.zip || ''}` : '-'],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <dt className="text-sm text-gray-500">{label}</dt>
                      <dd className="text-sm font-medium text-gray-900 mt-0.5">{val || '-'}</dd>
                    </div>
                  ))}
                  {company.notes && (
                    <div className="col-span-2">
                      <dt className="text-sm text-gray-500">Notes</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{company.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contacts at this company */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contacts ({company.contacts?.length || 0})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/crm/contacts')}>View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!company.contacts?.length ? (
                <p className="text-gray-500 text-sm text-center py-4">No contacts at this company.</p>
              ) : (
                <div className="space-y-3">
                  {company.contacts.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      onClick={() => navigate(`/crm/contacts/${c.id}`)}
                    >
                      <p className="font-medium text-sm text-gray-900">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-gray-500">{c.title || c.contact_type?.replace(/_/g, ' ')}</p>
                      {c.email && <p className="text-xs text-gray-500 mt-0.5">{c.email}</p>}
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
              {company.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {company.tags.map((tag, i) => (
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
                  <dd className="text-gray-900">{formatDate(company.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="text-gray-900">{formatDate(company.updated_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
