import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import RentRollTable from '../components/RentRollTable';
import OccupancyGauge from '../components/OccupancyGauge';
import { api } from '../lib/api';
import type {
  MasterProperty, ManagementTier, Tenant, LeaseType,
  OperatingExpense, ExpenseCategory, WorkOrder, WorkOrderPriority, WorkOrderStatus,
  Inspection, InspectionType,
  ComplianceItem, ComplianceItemType,
} from '../types';

type Tab = 'overview' | 'tenants' | 'expenses' | 'financials' | 'inspections' | 'work-orders' | 'compliance' | 'documents';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'financials', label: 'Financials' },
  { key: 'inspections', label: 'Inspections' },
  { key: 'work-orders', label: 'Work Orders' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'documents', label: 'Documents' },
];

const TIER_LABELS: Record<string, string> = {
  asset_management: 'Asset Management',
  asset_oversight: 'Asset Oversight',
  asset_monitoring: 'Asset Monitoring',
};

const TIER_COLORS: Record<string, string> = {
  asset_management: 'bg-purple-100 text-purple-700',
  asset_oversight: 'bg-blue-100 text-blue-700',
  asset_monitoring: 'bg-gray-100 text-gray-700',
};

const LEASE_TYPES: { value: LeaseType; label: string }[] = [
  { value: 'gross', label: 'Gross' },
  { value: 'modified_gross', label: 'Modified Gross' },
  { value: 'nnn', label: 'NNN' },
  { value: 'nn', label: 'NN' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'month_to_month', label: 'Month-to-Month' },
  { value: 'ground', label: 'Ground' },
];

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('en-US').format(n);

export default function ManagedPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<MasterProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.getProperty(id) as any;
        setProperty(res.property || res);
      } catch (err) {
        console.error('Failed to load property:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <Layout><div className="text-center py-12 text-gray-500">Loading property...</div></Layout>;
  }

  if (!property) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Property not found.</p>
          <Link to="/asset-services" className="text-primary-600 hover:underline mt-2 inline-block">Back to Portfolio</Link>
        </div>
      </Layout>
    );
  }

  const mgmtTier = (property as any).management_tier as ManagementTier | undefined;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumbs + Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/asset-services" className="hover:text-primary-600">Portfolio</Link>
            <span>/</span>
            <span className="text-gray-900">{property.address}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
            {mgmtTier && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[mgmtTier] || ''}`}>
                {TIER_LABELS[mgmtTier] || mgmtTier}
              </span>
            )}
          </div>
          {property.city && (
            <p className="text-sm text-gray-500 mt-1">{property.city}, {property.state} {property.zip}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
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

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab property={property} />}
        {activeTab === 'tenants' && id && <TenantsTab propertyId={id} buildingSize={property.building_size} />}
        {activeTab === 'expenses' && id && <ExpensesTab propertyId={id} />}
        {activeTab === 'financials' && id && <FinancialsTab propertyId={id} />}
        {activeTab === 'inspections' && id && <InspectionsTab propertyId={id} />}
        {activeTab === 'work-orders' && id && <WorkOrdersTab propertyId={id} />}
        {activeTab === 'compliance' && id && <ComplianceTab propertyId={id} />}
        {activeTab === 'documents' && <PlaceholderTab name="Documents" />}
      </div>
    </Layout>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================
function OverviewTab({ property }: { property: MasterProperty }) {
  const mgmt = property as any;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Property Details</h3>
        <dl className="space-y-3">
          {[
            ['Address', property.address],
            ['City', `${property.city || ''}, ${property.state || ''} ${property.zip || ''}`],
            ['Property Type', property.property_type],
            ['Building Size', property.building_size ? `${fmtNum(property.building_size)} SF` : '-'],
            ['Year Built', property.year_built],
            ['Percent Leased', property.percent_leased ? `${property.percent_leased}%` : '-'],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between">
              <dt className="text-sm text-gray-500">{label}</dt>
              <dd className="text-sm font-medium text-gray-900">{value || '-'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Management</h3>
        <dl className="space-y-3">
          {[
            ['Tier', mgmt.management_tier ? TIER_LABELS[mgmt.management_tier] : '-'],
            ['Fee', mgmt.management_fee_percent ? `${mgmt.management_fee_percent}%` : '-'],
            ['Start Date', mgmt.management_start_date || '-'],
            ['End Date', mgmt.management_end_date || '-'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-sm text-gray-500">{label}</dt>
              <dd className="text-sm font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        {mgmt.management_notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">{mgmt.management_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tenants Tab (Phase B)
// ============================================================================
function TenantsTab({ propertyId, buildingSize }: { propertyId: string; buildingSize?: number }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState({
    tenant_name: '', unit_number: '', lease_type: '' as string,
    lease_start: '', lease_end: '', monthly_base_rent: '',
    rent_per_sf: '', leased_sf: '', security_deposit: '',
    cam_share_percent: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listTenants(propertyId);
      setTenants(res.tenants || []);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const activeTenants = tenants.filter(t => t.is_active);
  const totalLeasedSf = activeTenants.reduce((s, t) => s + (t.leased_sf || 0), 0);
  const occupancy = buildingSize && buildingSize > 0 ? (totalLeasedSf / buildingSize) * 100 : 0;

  const openCreate = () => {
    setEditingTenant(null);
    setForm({ tenant_name: '', unit_number: '', lease_type: '', lease_start: '', lease_end: '', monthly_base_rent: '', rent_per_sf: '', leased_sf: '', security_deposit: '', cam_share_percent: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setEditingTenant(t);
    setForm({
      tenant_name: t.tenant_name, unit_number: t.unit_number || '', lease_type: t.lease_type || '',
      lease_start: t.lease_start || '', lease_end: t.lease_end || '',
      monthly_base_rent: t.monthly_base_rent?.toString() || '', rent_per_sf: t.rent_per_sf?.toString() || '',
      leased_sf: t.leased_sf?.toString() || '', security_deposit: t.security_deposit?.toString() || '',
      cam_share_percent: t.cam_share_percent?.toString() || '', notes: t.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        master_property_id: propertyId,
        tenant_name: form.tenant_name,
        unit_number: form.unit_number || null,
        lease_type: form.lease_type || null,
        lease_start: form.lease_start || null,
        lease_end: form.lease_end || null,
        monthly_base_rent: form.monthly_base_rent ? Number(form.monthly_base_rent) : null,
        rent_per_sf: form.rent_per_sf ? Number(form.rent_per_sf) : null,
        leased_sf: form.leased_sf ? Number(form.leased_sf) : null,
        security_deposit: form.security_deposit ? Number(form.security_deposit) : null,
        cam_share_percent: form.cam_share_percent ? Number(form.cam_share_percent) : null,
        notes: form.notes || null,
      };
      if (editingTenant) {
        await api.updateTenant(editingTenant.id, payload);
      } else {
        await api.createTenant(payload);
      }
      setShowModal(false);
      fetchTenants();
    } catch (err) {
      console.error('Failed to save tenant:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this tenant?')) return;
    try {
      await api.deleteTenant(id);
      fetchTenants();
    } catch (err) {
      console.error('Failed to delete tenant:', err);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading tenants...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-6">
        <OccupancyGauge percent={occupancy} />
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Occupancy</p>
          <p className="text-lg font-semibold">{fmtNum(totalLeasedSf)} / {buildingSize ? fmtNum(buildingSize) : '?'} SF</p>
          <p className="text-sm text-gray-500">{activeTenants.length} active tenant{activeTenants.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="ml-auto">
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Tenant
          </button>
        </div>
      </div>

      {/* Rent Roll Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tenants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No tenants yet. Add your first tenant.</div>
        ) : (
          <RentRollTable tenants={tenants} onEdit={openEdit} onDelete={handleDelete} />
        )}
      </div>

      {/* Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{editingTenant ? 'Edit Tenant' : 'Add Tenant'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Name *</label>
                    <input required value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit #</label>
                    <input value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lease Type</label>
                    <select value={form.lease_type} onChange={e => setForm(f => ({ ...f, lease_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">Select...</option>
                      {LEASE_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lease Start</label>
                    <input type="date" value={form.lease_start} onChange={e => setForm(f => ({ ...f, lease_start: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lease End</label>
                    <input type="date" value={form.lease_end} onChange={e => setForm(f => ({ ...f, lease_end: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leased SF</label>
                    <input type="number" value={form.leased_sf} onChange={e => setForm(f => ({ ...f, leased_sf: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rent</label>
                    <input type="number" step="0.01" value={form.monthly_base_rent} onChange={e => setForm(f => ({ ...f, monthly_base_rent: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rent/SF</label>
                    <input type="number" step="0.01" value={form.rent_per_sf} onChange={e => setForm(f => ({ ...f, rent_per_sf: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
                    <input type="number" step="0.01" value={form.security_deposit} onChange={e => setForm(f => ({ ...f, security_deposit: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CAM Share %</label>
                    <input type="number" step="0.01" value={form.cam_share_percent} onChange={e => setForm(f => ({ ...f, cam_share_percent: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : editingTenant ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Expenses Tab (Phase C)
// ============================================================================
function ExpensesTab({ propertyId }: { propertyId: string }) {
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: '', description: '', amount: '', expense_date: '', is_cam_recoverable: false, notes: '' });
  const [saving, setSaving] = useState(false);

  const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: 'property_tax', label: 'Property Tax' }, { value: 'insurance', label: 'Insurance' },
    { value: 'utilities_water', label: 'Water' }, { value: 'utilities_electric', label: 'Electric' },
    { value: 'utilities_gas', label: 'Gas' }, { value: 'utilities_trash', label: 'Trash' },
    { value: 'maintenance_repair', label: 'Maintenance & Repair' }, { value: 'landscaping', label: 'Landscaping' },
    { value: 'janitorial', label: 'Janitorial' }, { value: 'security', label: 'Security' },
    { value: 'management_fee', label: 'Management Fee' }, { value: 'legal', label: 'Legal' },
    { value: 'accounting', label: 'Accounting' }, { value: 'marketing', label: 'Marketing' },
    { value: 'capital_improvement', label: 'Capital Improvement' }, { value: 'pest_control', label: 'Pest Control' },
    { value: 'hvac', label: 'HVAC' }, { value: 'roof_repair', label: 'Roof Repair' },
    { value: 'parking_lot', label: 'Parking Lot' }, { value: 'signage', label: 'Signage' },
    { value: 'other', label: 'Other' },
  ];

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listExpenses({ property_id: propertyId });
      setExpenses(res.expenses || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createExpense({
        master_property_id: propertyId,
        category: form.category || null,
        description: form.description,
        amount: form.amount ? Number(form.amount) : null,
        expense_date: form.expense_date || null,
        is_cam_recoverable: form.is_cam_recoverable,
        notes: form.notes || null,
      });
      setShowModal(false);
      setForm({ category: '', description: '', amount: '', expense_date: '', is_cam_recoverable: false, notes: '' });
      fetchExpenses();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const camRecoverable = expenses.filter(e => e.is_cam_recoverable).reduce((s, e) => s + (e.amount || 0), 0);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading expenses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-500">Total Expenses</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CAM Recoverable</p>
            <p className="text-lg font-bold text-green-600">{fmt(camRecoverable)}</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Expense
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No expenses recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">CAM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{exp.expense_date || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{CATEGORIES.find(c => c.value === exp.category)?.label || exp.category || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{exp.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{exp.amount ? fmt(exp.amount) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {exp.is_cam_recoverable && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">CAM</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Expense</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_cam_recoverable} onChange={e => setForm(f => ({ ...f, is_cam_recoverable: e.target.checked }))} className="rounded border-gray-300" />
                CAM Recoverable
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Financials Tab (Phase D)
// ============================================================================
function FinancialsTab({ propertyId }: { propertyId: string }) {
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getOwnerStatement({ property_id: propertyId, month: currentMonth });
        setStatement(res);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    })();
  }, [propertyId, currentMonth]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading financials...</div>;

  if (!statement?.success) {
    return <div className="text-center py-12 text-gray-500">No financial data available yet. Record rent payments and expenses to generate reports.</div>;
  }

  const data = statement.statement;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Monthly Owner Statement - {currentMonth}</h3>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="flex justify-between border-b pb-2">
            <span className="text-sm font-medium text-gray-700">Total Rent Collected</span>
            <span className="text-sm font-bold text-green-600">{fmt(data?.total_rent_collected || 0)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-sm font-medium text-gray-700">Total Expenses</span>
            <span className="text-sm font-bold text-red-600">{fmt(data?.total_expenses || 0)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-sm font-medium text-gray-700">Management Fee</span>
            <span className="text-sm font-bold text-gray-600">{fmt(data?.management_fee || 0)}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-base font-semibold text-gray-900">Net to Owner</span>
            <span className="text-base font-bold text-gray-900">{fmt(data?.net_to_owner || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inspections Tab (Phase E)
// ============================================================================
function InspectionsTab({ propertyId }: { propertyId: string }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ inspection_type: 'routine' as string, inspection_date: '', inspector_name: '', overall_rating: '', summary: '' });
  const [saving, setSaving] = useState(false);

  const TYPES: { value: InspectionType; label: string }[] = [
    { value: 'routine', label: 'Routine' }, { value: 'move_in', label: 'Move In' },
    { value: 'move_out', label: 'Move Out' }, { value: 'annual', label: 'Annual' },
    { value: 'emergency', label: 'Emergency' }, { value: 'insurance', label: 'Insurance' },
  ];

  const fetchInspections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listInspections({ property_id: propertyId });
      setInspections(res.inspections || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchInspections(); }, [fetchInspections]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createInspection({
        master_property_id: propertyId,
        inspection_type: form.inspection_type,
        inspection_date: form.inspection_date || null,
        inspector_name: form.inspector_name || null,
        overall_rating: form.overall_rating ? Number(form.overall_rating) : null,
        summary: form.summary || null,
      });
      setShowModal(false);
      fetchInspections();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading inspections...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Inspections</h3>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Inspection
        </button>
      </div>

      {inspections.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">No inspections recorded yet.</div>
      ) : (
        <div className="space-y-4">
          {inspections.map(insp => (
            <div key={insp.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mr-2">{TYPES.find(t => t.value === insp.inspection_type)?.label || insp.inspection_type}</span>
                  <span className="text-sm text-gray-600">{insp.inspection_date || 'No date'}</span>
                </div>
                {insp.overall_rating && <span className="text-yellow-500">{'★'.repeat(insp.overall_rating)}{'☆'.repeat(5 - insp.overall_rating)}</span>}
              </div>
              {insp.inspector_name && <p className="text-sm text-gray-500 mt-1">Inspector: {insp.inspector_name}</p>}
              {insp.summary && <p className="text-sm text-gray-700 mt-2">{insp.summary}</p>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Inspection</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.inspection_type} onChange={e => setForm(f => ({ ...f, inspection_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.inspection_date} onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                  <select value={form.overall_rating} onChange={e => setForm(f => ({ ...f, overall_rating: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">--</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Inspector</label>
                <input value={form.inspector_name} onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
                <textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Work Orders Tab (Phase E)
// ============================================================================
function WorkOrdersTab({ propertyId }: { propertyId: string }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as string, category: '', estimated_cost: '', scheduled_date: '' });
  const [saving, setSaving] = useState(false);

  const PRIORITIES: { value: WorkOrderPriority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700' },
  ];

  const STATUS_COLORS: Record<WorkOrderStatus, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    on_hold: 'bg-gray-100 text-gray-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listWorkOrders({ property_id: propertyId });
      setWorkOrders(res.work_orders || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchWorkOrders(); }, [fetchWorkOrders]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createWorkOrder({
        master_property_id: propertyId,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        category: form.category || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
        scheduled_date: form.scheduled_date || null,
      });
      setShowModal(false);
      setForm({ title: '', description: '', priority: 'medium', category: '', estimated_cost: '', scheduled_date: '' });
      fetchWorkOrders();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: WorkOrderStatus) => {
    try {
      await api.updateWorkOrder(id, { status, ...(status === 'completed' ? { completed_date: new Date().toISOString().split('T')[0] } : {}) });
      fetchWorkOrders();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading work orders...</div>;

  const openOrders = workOrders.filter(wo => !['completed', 'cancelled'].includes(wo.status));
  const closedOrders = workOrders.filter(wo => ['completed', 'cancelled'].includes(wo.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Work Orders ({openOrders.length} open)</h3>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Work Order
        </button>
      </div>

      {workOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">No work orders yet.</div>
      ) : (
        <div className="space-y-4">
          {[...openOrders, ...closedOrders].map(wo => (
            <div key={wo.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{wo.title}</h4>
                  {wo.description && <p className="text-sm text-gray-500 mt-1">{wo.description}</p>}
                </div>
                <div className="flex gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITIES.find(p => p.value === wo.priority)?.color || ''}`}>
                    {wo.priority}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[wo.status] || ''}`}>
                    {wo.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                {wo.scheduled_date && <span>Scheduled: {wo.scheduled_date}</span>}
                {wo.estimated_cost && <span>Est: {fmt(wo.estimated_cost)}</span>}
                {wo.actual_cost && <span>Actual: {fmt(wo.actual_cost)}</span>}
              </div>
              {!['completed', 'cancelled'].includes(wo.status) && (
                <div className="flex gap-2 mt-3">
                  {wo.status === 'open' && <button onClick={() => updateStatus(wo.id, 'assigned')} className="text-xs text-blue-600 hover:underline">Assign</button>}
                  {wo.status === 'assigned' && <button onClick={() => updateStatus(wo.id, 'in_progress')} className="text-xs text-purple-600 hover:underline">Start</button>}
                  {['assigned', 'in_progress'].includes(wo.status) && <button onClick={() => updateStatus(wo.id, 'completed')} className="text-xs text-green-600 hover:underline">Complete</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Work Order</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Est. Cost</label>
                  <input type="number" step="0.01" value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compliance Tab (Phase F)
// ============================================================================
function ComplianceTab({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ item_type: 'fire_inspection' as string, title: '', description: '', due_date: '', is_recurring: true, recurrence_months: '12' });
  const [saving, setSaving] = useState(false);

  const TYPES: { value: ComplianceItemType; label: string }[] = [
    { value: 'fire_inspection', label: 'Fire Inspection' }, { value: 'elevator_cert', label: 'Elevator Cert' },
    { value: 'backflow_test', label: 'Backflow Test' }, { value: 'roof_warranty', label: 'Roof Warranty' },
    { value: 'insurance_renewal', label: 'Insurance Renewal' }, { value: 'tax_filing', label: 'Tax Filing' },
    { value: 'business_license', label: 'Business License' }, { value: 'ada_compliance', label: 'ADA Compliance' },
    { value: 'environmental', label: 'Environmental' }, { value: 'hvac_service', label: 'HVAC Service' },
    { value: 'pest_control_service', label: 'Pest Control' }, { value: 'other', label: 'Other' },
  ];

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listComplianceItems({ property_id: propertyId });
      setItems(res.items || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createComplianceItem({
        master_property_id: propertyId,
        item_type: form.item_type,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        is_recurring: form.is_recurring,
        recurrence_months: form.recurrence_months ? Number(form.recurrence_months) : null,
      });
      setShowModal(false);
      fetchItems();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const markComplete = async (item: ComplianceItem) => {
    try {
      await api.updateComplianceItem(item.id, { completed_date: new Date().toISOString().split('T')[0] });
      fetchItems();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading compliance items...</div>;

  const overdue = items.filter(i => !i.completed_date && i.due_date && new Date(i.due_date) < new Date());
  const upcoming = items.filter(i => !i.completed_date && i.due_date && new Date(i.due_date) >= new Date());
  const completed = items.filter(i => i.completed_date);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          {overdue.length > 0 && <span className="text-sm font-medium text-red-600">{overdue.length} overdue</span>}
          <span className="text-sm text-gray-500">{upcoming.length} upcoming</span>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">No compliance items yet.</div>
      ) : (
        <div className="space-y-3">
          {[...overdue, ...upcoming, ...completed].map(item => {
            const isOverdue = !item.completed_date && item.due_date && new Date(item.due_date) < new Date();
            return (
              <div key={item.id} className={`bg-white rounded-xl border p-4 ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.completed_date ? (
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                    ) : (
                      <button onClick={() => markComplete(item)} className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-green-500 transition-colors" title="Mark complete" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${item.completed_date ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.title}</p>
                      <p className="text-xs text-gray-500">{TYPES.find(t => t.value === item.item_type)?.label || item.item_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.due_date && (
                      <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        Due: {item.due_date}
                      </p>
                    )}
                    {item.is_recurring && <p className="text-xs text-gray-400">Recurring every {item.recurrence_months}mo</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Compliance Item</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} className="rounded border-gray-300" />
                  Recurring
                </label>
                {form.is_recurring && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Every</span>
                    <input type="number" value={form.recurrence_months} onChange={e => setForm(f => ({ ...f, recurrence_months: e.target.value }))} className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm" />
                    <span className="text-sm text-gray-500">months</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ name }: { name: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
      <p className="text-gray-500">{name} tab coming soon.</p>
    </div>
  );
}
