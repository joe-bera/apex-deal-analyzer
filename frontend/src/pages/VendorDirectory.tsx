import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import type { Vendor } from '../types';

const TRADES = [
  'Plumbing', 'Electrical', 'HVAC', 'Roofing', 'Painting', 'Landscaping',
  'Janitorial', 'Security', 'Pest Control', 'General Contractor', 'Flooring',
  'Fire Protection', 'Elevator', 'Locksmith', 'Glass/Windows', 'Paving',
  'Signage', 'Other',
];

const emptyForm = {
  name: '', company_name: '', trade: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '',
  license_number: '', insurance_expiry: '', w9_on_file: false,
  rating: 0, is_preferred: false, notes: '',
};

export default function VendorDirectory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tradeFilter) params.trade = tradeFilter;
      if (preferredOnly) params.is_preferred = 'true';
      const res = await api.listVendors(params);
      setVendors(res.vendors || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  }, [search, tradeFilter, preferredOnly]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openCreate = () => {
    setEditingVendor(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setForm({
      name: v.name || '', company_name: v.company_name || '', trade: v.trade || '',
      email: v.email || '', phone: v.phone || '',
      address: v.address || '', city: v.city || '', state: v.state || '', zip: v.zip || '',
      license_number: v.license_number || '',
      insurance_expiry: v.insurance_expiry?.split('T')[0] || '',
      w9_on_file: v.w9_on_file || false,
      rating: v.rating || 0, is_preferred: v.is_preferred || false,
      notes: v.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        insurance_expiry: form.insurance_expiry || null,
        rating: form.rating || null,
      };
      if (editingVendor) {
        await api.updateVendor(editingVendor.id, payload);
      } else {
        await api.createVendor(payload);
      }
      setShowModal(false);
      fetchVendors();
    } catch (err) {
      console.error('Failed to save vendor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor?')) return;
    try {
      await api.deleteVendor(id);
      fetchVendors();
    } catch (err) {
      console.error('Failed to delete vendor:', err);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Directory</h1>
            <p className="text-sm text-gray-500 mt-1">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
          />
          <select
            value={tradeFilter}
            onChange={e => setTradeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Trades</option>
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={preferredOnly}
              onChange={e => setPreferredOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Preferred Only
          </label>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading vendors...</div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No vendors found.{' '}
            <button onClick={openCreate} className="text-primary-600 hover:underline">Add your first vendor</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{v.name}</div>
                        {v.company_name && <div className="text-xs text-gray-500">{v.company_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.trade || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.email || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {v.rating ? (
                          <span className="text-yellow-500">{'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {v.is_preferred && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Preferred</span>
                          )}
                          {v.w9_on_file && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">W9</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(v)} className="text-primary-600 hover:text-primary-800 text-sm mr-3">Edit</button>
                        <button onClick={() => handleDelete(v.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <input
                      value={form.company_name}
                      onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
                    <select
                      value={form.trade}
                      onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select trade</option>
                      {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License #</label>
                    <input
                      value={form.license_number}
                      onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                      <input
                        value={form.zip}
                        onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Expiry</label>
                    <input
                      type="date"
                      value={form.insurance_expiry}
                      onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <select
                      value={form.rating}
                      onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value={0}>No rating</option>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.w9_on_file}
                        onChange={e => setForm(f => ({ ...f, w9_on_file: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      W-9 on file
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_preferred}
                        onChange={e => setForm(f => ({ ...f, is_preferred: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      Preferred vendor
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingVendor ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
