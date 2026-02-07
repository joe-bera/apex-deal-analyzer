import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { Badge, PropertyTypeBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { api } from '../lib/api';
import type {
  ProspectListFilters,
  ProspectList,
  ProspectListItem,
  ProspectListItemStatus,
  MasterProperty,
} from '../types';

const STATUS_OPTIONS: { value: ProspectListItemStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'not_interested', label: 'Not Interested' },
];

const PROPERTY_TYPES = [
  'industrial', 'retail', 'office', 'multifamily', 'land', 'residential', 'special_purpose',
];

function formatCurrency(val?: number | null) {
  if (val == null) return '—';
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(val?: number | null) {
  if (val == null) return '—';
  return val.toLocaleString('en-US');
}

export default function Prospecting() {
  const [activeTab, setActiveTab] = useState<'search' | 'lists'>('search');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospecting</h1>
          <p className="text-gray-500 mt-1">Filter properties and build targeted prospect lists</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('search')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Search & Filter
            </button>
            <button
              onClick={() => setActiveTab('lists')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'lists'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Saved Lists
            </button>
          </nav>
        </div>

        {activeTab === 'search' ? <SearchFilterTab /> : <SavedListsTab />}
      </div>
    </Layout>
  );
}

// ============================================================================
// Search & Filter Tab
// ============================================================================
function SearchFilterTab() {
  const [filters, setFilters] = useState<ProspectListFilters>({});
  const [previewResults, setPreviewResults] = useState<MasterProperty[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPreview = useCallback(async (f: ProspectListFilters) => {
    // Only run if at least one filter is set
    const hasFilters = Object.values(f).some(v =>
      v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
    );
    if (!hasFilters) {
      setPreviewResults([]);
      setPreviewCount(null);
      return;
    }

    setLoading(true);
    try {
      const res = await api.previewProspectFilter(f);
      setPreviewResults(res.properties || []);
      setPreviewCount(res.count ?? 0);
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced preview
  const updateFilters = useCallback((newFilters: ProspectListFilters) => {
    setFilters(newFilters);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runPreview(newFilters), 500);
  }, [runPreview]);

  const setFilterField = <K extends keyof ProspectListFilters>(key: K, value: ProspectListFilters[K]) => {
    updateFilters({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: keyof ProspectListFilters, value: string) => {
    const current = (filters[key] as string[] | undefined) || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setFilterField(key, next.length > 0 ? next : undefined);
  };

  const clearFilters = () => {
    setFilters({});
    setPreviewResults([]);
    setPreviewCount(null);
  };

  return (
    <div className="space-y-6">
      {/* Collapsible Filters */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full flex items-center justify-between px-6 py-4"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-semibold text-gray-900">Filters</span>
            {previewCount !== null && (
              <Badge variant="primary" size="sm">{previewCount} results</Badge>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {filtersOpen && (
          <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-4">
            {/* Text Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Address, property name, or city..."
                value={filters.search || ''}
                onChange={e => setFilterField('search', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPES.map(pt => (
                    <button
                      key={pt}
                      onClick={() => toggleArrayFilter('property_type', pt)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        (filters.property_type || []).includes(pt)
                          ? 'bg-primary-100 text-primary-700 border-primary-300'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pt.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Ontario, Riverside"
                    value={(filters.city || []).join(', ')}
                    onChange={e => {
                      const cities = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                      setFilterField('city', cities.length > 0 ? cities : undefined);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. CA"
                    value={(filters.state || []).join(', ')}
                    onChange={e => {
                      const states = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                      setFilterField('state', states.length > 0 ? states : undefined);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submarket</label>
                  <input
                    type="text"
                    placeholder="e.g. Inland Empire West"
                    value={(filters.submarket || []).join(', ')}
                    onChange={e => {
                      const subs = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setFilterField('submarket', subs.length > 0 ? subs : undefined);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Owner */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="Search owner..."
                  value={filters.owner_name || ''}
                  onChange={e => setFilterField('owner_name', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <RangeFilter
                label="Building Size (SF)"
                minVal={filters.building_size_min}
                maxVal={filters.building_size_max}
                onMinChange={v => setFilterField('building_size_min', v)}
                onMaxChange={v => setFilterField('building_size_max', v)}
              />
              <RangeFilter
                label="Lot Size (Acres)"
                minVal={filters.lot_size_acres_min}
                maxVal={filters.lot_size_acres_max}
                onMinChange={v => setFilterField('lot_size_acres_min', v)}
                onMaxChange={v => setFilterField('lot_size_acres_max', v)}
                step={0.1}
              />
              <RangeFilter
                label="Year Built"
                minVal={filters.year_built_min}
                maxVal={filters.year_built_max}
                onMinChange={v => setFilterField('year_built_min', v)}
                onMaxChange={v => setFilterField('year_built_max', v)}
                minPlaceholder="1900"
                maxPlaceholder="2026"
              />
              <RangeFilter
                label="Sale Price"
                minVal={filters.sale_price_min}
                maxVal={filters.sale_price_max}
                onMinChange={v => setFilterField('sale_price_min', v)}
                onMaxChange={v => setFilterField('sale_price_max', v)}
                prefix="$"
              />
              <RangeFilter
                label="Price / SF"
                minVal={filters.price_per_sf_min}
                maxVal={filters.price_per_sf_max}
                onMinChange={v => setFilterField('price_per_sf_min', v)}
                onMaxChange={v => setFilterField('price_per_sf_max', v)}
                prefix="$"
              />
              <RangeFilter
                label="Cap Rate (%)"
                minVal={filters.cap_rate_min}
                maxVal={filters.cap_rate_max}
                onMinChange={v => setFilterField('cap_rate_min', v)}
                onMaxChange={v => setFilterField('cap_rate_max', v)}
                step={0.1}
                suffix="%"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear All
              </button>
              {previewCount !== null && previewCount > 0 && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  Save as List ({previewCount})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Results */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Searching properties...</p>
        </div>
      ) : previewResults.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Results <span className="text-gray-500 font-normal">({previewCount} total, showing first 20)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <PropertyTable properties={previewResults} />
          </div>
        </div>
      ) : previewCount === 0 ? (
        <EmptyState
          title="No properties match"
          description="Try adjusting your filters to find more results."
        />
      ) : null}

      {/* Save Modal */}
      {showSaveModal && (
        <SaveListModal
          filters={filters}
          resultCount={previewCount || 0}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Range Filter Component
// ============================================================================
function RangeFilter({
  label,
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  step = 1,
  prefix,
  suffix,
  minPlaceholder = 'Min',
  maxPlaceholder = 'Max',
}: {
  label: string;
  minVal?: number;
  maxVal?: number;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {prefix && <span className="absolute left-3 top-2 text-gray-400 text-sm">{prefix}</span>}
          <input
            type="number"
            step={step}
            placeholder={minPlaceholder}
            value={minVal ?? ''}
            onChange={e => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${prefix ? 'pl-7' : ''}`}
          />
          {suffix && <span className="absolute right-3 top-2 text-gray-400 text-sm">{suffix}</span>}
        </div>
        <span className="text-gray-400 text-sm">to</span>
        <div className="relative flex-1">
          {prefix && <span className="absolute left-3 top-2 text-gray-400 text-sm">{prefix}</span>}
          <input
            type="number"
            step={step}
            placeholder={maxPlaceholder}
            value={maxVal ?? ''}
            onChange={e => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${prefix ? 'pl-7' : ''}`}
          />
          {suffix && <span className="absolute right-3 top-2 text-gray-400 text-sm">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Property Table (used in preview and list detail)
// ============================================================================
function PropertyTable({ properties }: { properties: MasterProperty[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
          <th className="px-6 py-3">Address</th>
          <th className="px-4 py-3">City / State</th>
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3 text-right">Building SF</th>
          <th className="px-4 py-3 text-right">Sale Price</th>
          <th className="px-4 py-3 text-right">Price/SF</th>
          <th className="px-4 py-3 text-right">Cap Rate</th>
          <th className="px-4 py-3">Owner</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {properties.map(p => (
          <tr key={p.id} className="hover:bg-gray-50">
            <td className="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">{p.address || '—'}</td>
            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
            <td className="px-4 py-3">{p.property_type ? <PropertyTypeBadge type={p.property_type} /> : '—'}</td>
            <td className="px-4 py-3 text-right text-gray-600">{formatNumber(p.building_size)}</td>
            <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p.latest_sale_price)}</td>
            <td className="px-4 py-3 text-right text-gray-600">{p.latest_price_per_sf ? `$${p.latest_price_per_sf.toFixed(2)}` : '—'}</td>
            <td className="px-4 py-3 text-right text-gray-600">{p.latest_cap_rate ? `${p.latest_cap_rate.toFixed(2)}%` : '—'}</td>
            <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{p.owner_name || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// Save List Modal
// ============================================================================
function SaveListModal({
  filters,
  resultCount,
  onClose,
}: {
  filters: ProspectListFilters;
  resultCount: number;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    try {
      await api.createProspectList({ name: name.trim(), description: description.trim() || undefined, filters });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Prospect List</h3>
        <p className="text-sm text-gray-500 mb-4">{resultCount} properties will be added to this list.</p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">List Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ontario Industrial 50k+ SF"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes about this list..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save List'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Saved Lists Tab
// ============================================================================
function SavedListsTab() {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<ProspectListItem[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ProspectListItemStatus>('contacted');

  const fetchLists = useCallback(async () => {
    try {
      const res = await api.listProspectLists();
      setLists(res.prospect_lists || []);
    } catch (err) {
      console.error('Error fetching lists:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleExpand = async (listId: string) => {
    if (expandedListId === listId) {
      setExpandedListId(null);
      setExpandedItems([]);
      setSelectedItems(new Set());
      return;
    }
    setExpandedListId(listId);
    setExpandedLoading(true);
    setSelectedItems(new Set());
    try {
      const res = await api.getProspectList(listId);
      setExpandedItems(res.items || []);
    } catch (err) {
      console.error('Error loading list:', err);
    } finally {
      setExpandedLoading(false);
    }
  };

  const handleRefresh = async (listId: string) => {
    try {
      await api.refreshProspectList(listId);
      await fetchLists();
      if (expandedListId === listId) {
        const res = await api.getProspectList(listId);
        setExpandedItems(res.items || []);
      }
    } catch (err) {
      console.error('Error refreshing list:', err);
    }
  };

  const handleDelete = async (listId: string) => {
    if (!window.confirm('Delete this prospect list? This cannot be undone.')) return;
    try {
      await api.deleteProspectList(listId);
      setLists(prev => prev.filter(l => l.id !== listId));
      if (expandedListId === listId) {
        setExpandedListId(null);
        setExpandedItems([]);
      }
    } catch (err) {
      console.error('Error deleting list:', err);
    }
  };

  const handleExport = async (listId: string) => {
    try {
      await api.exportProspectListCSV(listId);
    } catch (err) {
      console.error('Error exporting list:', err);
    }
  };

  const handleItemStatusChange = async (listId: string, itemId: string, status: ProspectListItemStatus) => {
    try {
      await api.updateProspectListItem(listId, itemId, { status });
      setExpandedItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, status } : item)
      );
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === expandedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(expandedItems.map(i => i.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (!expandedListId || selectedItems.size === 0) return;
    try {
      await api.bulkUpdateProspectListItems(expandedListId, {
        item_ids: Array.from(selectedItems),
        status: bulkStatus,
      });
      setExpandedItems(prev =>
        prev.map(item => selectedItems.has(item.id) ? { ...item, status: bulkStatus } : item)
      );
      setSelectedItems(new Set());
    } catch (err) {
      console.error('Error bulk updating:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
        <p className="text-gray-500 mt-3 text-sm">Loading lists...</p>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        title="No prospect lists yet"
        description="Use the Search & Filter tab to find properties and save them as a prospect list."
      />
    );
  }

  return (
    <div className="space-y-4">
      {lists.map(list => (
        <div key={list.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* List Card Header */}
          <div
            className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => handleExpand(list.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900 truncate">{list.name}</h3>
                <Badge variant="primary" size="sm">{list.result_count} properties</Badge>
              </div>
              {list.description && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">{list.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Created {new Date(list.created_at).toLocaleDateString()}
                {list.last_refreshed_at && ` · Refreshed ${new Date(list.last_refreshed_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleRefresh(list.id)}
                title="Refresh"
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => handleExport(list.id)}
                title="Export CSV"
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(list.id)}
                title="Delete"
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedListId === list.id ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Expanded Items */}
          {expandedListId === list.id && (
            <div className="border-t border-gray-100">
              {expandedLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
                </div>
              ) : expandedItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No items in this list. Try refreshing.</div>
              ) : (
                <>
                  {/* Bulk Actions Bar */}
                  {selectedItems.size > 0 && (
                    <div className="px-6 py-3 bg-primary-50 border-b border-primary-100 flex items-center gap-3">
                      <span className="text-sm font-medium text-primary-700">
                        {selectedItems.size} selected
                      </span>
                      <select
                        value={bulkStatus}
                        onChange={e => setBulkStatus(e.target.value as ProspectListItemStatus)}
                        className="px-3 py-1.5 border border-primary-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleBulkUpdate}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                          <th className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedItems.size === expandedItems.length && expandedItems.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Address</th>
                          <th className="px-4 py-3">City / State</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Building SF</th>
                          <th className="px-4 py-3 text-right">Sale Price</th>
                          <th className="px-4 py-3 text-right">Cap Rate</th>
                          <th className="px-4 py-3">Owner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {expandedItems.map(item => {
                          const p = item.property;
                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(item.id)}
                                  onChange={() => toggleSelectItem(item.id)}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={item.status}
                                  onChange={e =>
                                    handleItemStatusChange(list.id, item.id, e.target.value as ProspectListItemStatus)
                                  }
                                  className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-primary-500"
                                >
                                  {STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p?.address || '—'}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{[p?.city, p?.state].filter(Boolean).join(', ') || '—'}</td>
                              <td className="px-4 py-3">{p?.property_type ? <PropertyTypeBadge type={p.property_type} /> : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{formatNumber(p?.building_size)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p?.latest_sale_price)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{p?.latest_cap_rate ? `${p.latest_cap_rate.toFixed(2)}%` : '—'}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{p?.owner_name || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
