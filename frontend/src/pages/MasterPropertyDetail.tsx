import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import { api } from '../lib/api';
import type { OwnerResearch, OwnerEntityType, ResearchSource, ManagementTier } from '../types';

interface PropertyData {
  id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  property_name?: string;
  building_park?: string;
  apn?: string;
  costar_id?: string;
  crexi_id?: string;
  unit_suite?: string;
  property_type?: string;
  property_subtype?: string;
  building_class?: string;
  building_status?: string;
  zoning?: string;
  submarket?: string;
  market?: string;
  building_size?: number;
  land_area_sf?: number;
  lot_size_acres?: number;
  typical_floor_size?: number;
  number_of_floors?: number;
  number_of_units?: number;
  number_of_buildings?: number;
  number_of_addresses?: number;
  year_built?: number;
  month_built?: number;
  year_renovated?: number;
  month_renovated?: number;
  construction_material?: string;
  clear_height_ft?: number;
  dock_doors?: number;
  grade_doors?: number;
  rail_served?: boolean;
  column_spacing?: string;
  sprinkler_type?: string;
  number_of_cranes?: number;
  power?: string;
  office_percentage?: number;
  office_space?: number;
  number_of_elevators?: number;
  parking_spaces?: number;
  parking_ratio?: number;
  percent_leased?: number;
  vacancy_percent?: number;
  days_on_market?: number;
  rent_per_sf?: number;
  avg_weighted_rent?: number;
  cross_street?: string;
  opportunity_zone?: boolean;
  latitude?: number;
  longitude?: number;
  owner_name?: string;
  owner_contact?: string;
  owner_address?: string;
  owner_phone?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  mailing_care_of?: string;
  parent_company?: string;
  fund_name?: string;
  property_manager_name?: string;
  property_manager_phone?: string;
  leasing_company_name?: string;
  leasing_company_contact?: string;
  leasing_company_phone?: string;
  developer_name?: string;
  architect_name?: string;
  improvement_value?: number;
  land_value?: number;
  total_parcel_value?: number;
  parcel_value_type?: string;
  tax_year?: number;
  annual_tax_bill?: number;
  water?: string;
  sewer?: string;
  gas?: string;
  amenities?: string;
  features?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface Transaction {
  id: string;
  transaction_type: string;
  transaction_date?: string;
  recording_date?: string;
  // Sale
  sale_price?: number;
  price_per_sf?: number;
  cap_rate?: number;
  noi?: number;
  // Parties
  buyer_name?: string;
  seller_name?: string;
  broker_name?: string;
  broker_company?: string;
  // Lease
  tenant_name?: string;
  lease_type?: string;
  lease_term_months?: number;
  rent_per_sf_year?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  // Listing
  asking_price?: number;
  asking_price_per_sf?: number;
  days_on_market?: number;
  listing_status?: string;
  asking_cap_rate?: number;
  // Financing
  lender?: string;
  loan_amount?: number;
  loan_type?: string;
  interest_rate?: number;
  maturity_date?: string;
  // Meta
  source?: string;
  notes?: string;
  created_at?: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number | null | undefined) => {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US').format(value);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Helper to display a labeled field only if a value exists
function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  if (value == null || value === '' || value === false) return null;
  const display = typeof value === 'boolean' ? 'Yes' : String(value);
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{display}</dd>
    </div>
  );
}

// Returns true if the property has at least one non-empty value for any of the given keys
function hasAnyValue(obj: PropertyData, keys: (keyof PropertyData)[]) {
  return keys.some((k) => {
    const v = obj[k];
    return v != null && v !== '' && v !== false;
  });
}

// ── Transaction Expandable Card ─────────────────────────────────
function TransactionCard({ tx }: { tx: Transaction }) {
  const [expanded, setExpanded] = useState(false);

  const typeBadge: Record<string, { color: string; label: string }> = {
    sale: { color: 'bg-green-100 text-green-800', label: 'Sale' },
    lease: { color: 'bg-blue-100 text-blue-800', label: 'Lease' },
    listing: { color: 'bg-purple-100 text-purple-800', label: 'Listing' },
    off_market: { color: 'bg-gray-100 text-gray-800', label: 'Off Market' },
  };
  const badge = typeBadge[tx.transaction_type] || typeBadge.off_market;

  // Build headline depending on type
  const headline = tx.transaction_type === 'sale'
    ? formatCurrency(tx.sale_price)
    : tx.transaction_type === 'lease'
    ? (tx.tenant_name || 'Lease')
    : tx.transaction_type === 'listing'
    ? `Asking ${formatCurrency(tx.asking_price)}`
    : 'Off Market';

  const subline = tx.transaction_type === 'sale'
    ? [tx.price_per_sf ? `$${tx.price_per_sf.toFixed(0)}/SF` : null, tx.cap_rate ? `${tx.cap_rate.toFixed(2)}% Cap` : null].filter(Boolean).join(' · ')
    : tx.transaction_type === 'lease'
    ? [tx.lease_type, tx.rent_per_sf_year ? `$${tx.rent_per_sf_year.toFixed(2)}/SF/yr` : null].filter(Boolean).join(' · ')
    : tx.transaction_type === 'listing'
    ? [tx.asking_price_per_sf ? `$${tx.asking_price_per_sf.toFixed(0)}/SF` : null, tx.days_on_market ? `${tx.days_on_market} DOM` : null, tx.listing_status].filter(Boolean).join(' · ')
    : '';

  // Check which detail sections have data
  const hasSaleDetails = tx.transaction_type === 'sale' && (tx.noi || tx.buyer_name || tx.seller_name || tx.recording_date);
  const hasLeaseDetails = tx.transaction_type === 'lease' && (tx.lease_term_months || tx.lease_start_date || tx.lease_end_date || tx.rent_per_sf_year);
  const hasListingDetails = tx.transaction_type === 'listing' && (tx.asking_cap_rate || tx.days_on_market || tx.listing_status);
  const hasParties = tx.buyer_name || tx.seller_name || tx.broker_name || tx.broker_company;
  const hasFinancing = tx.lender || tx.loan_amount || tx.loan_type || tx.interest_rate || tx.maturity_date;
  const hasMeta = tx.source || tx.notes;
  const hasDetails = hasSaleDetails || hasLeaseDetails || hasListingDetails || hasParties || hasFinancing || hasMeta;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? 'border-gray-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* Summary Row — always visible */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.color}`}>
            {badge.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{headline}</p>
            {subline && <p className="text-xs text-gray-500 mt-0.5">{subline}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          <span className="text-sm text-gray-500">{formatDate(tx.transaction_date)}</span>
          {hasDetails && (
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && hasDetails && (
        <div className="border-t bg-gray-50 px-5 py-4 space-y-5">
          {/* Sale Details */}
          {tx.transaction_type === 'sale' && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sale Details</h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <TxField label="Sale Price" value={formatCurrency(tx.sale_price)} />
                <TxField label="Price/SF" value={tx.price_per_sf ? `$${tx.price_per_sf.toFixed(2)}` : null} />
                <TxField label="Cap Rate" value={tx.cap_rate ? `${tx.cap_rate.toFixed(2)}%` : null} />
                <TxField label="NOI" value={formatCurrency(tx.noi)} />
                <TxField label="Recording Date" value={formatDate(tx.recording_date)} />
              </dl>
            </div>
          )}

          {/* Lease Details */}
          {tx.transaction_type === 'lease' && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lease Details</h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <TxField label="Tenant" value={tx.tenant_name} />
                <TxField label="Lease Type" value={tx.lease_type} />
                <TxField label="Rent/SF/Yr" value={tx.rent_per_sf_year ? `$${tx.rent_per_sf_year.toFixed(2)}` : null} />
                <TxField label="Term" value={tx.lease_term_months ? `${tx.lease_term_months} months` : null} />
                <TxField label="Start Date" value={formatDate(tx.lease_start_date)} />
                <TxField label="End Date" value={formatDate(tx.lease_end_date)} />
              </dl>
            </div>
          )}

          {/* Listing Details */}
          {tx.transaction_type === 'listing' && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Listing Details</h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <TxField label="Asking Price" value={formatCurrency(tx.asking_price)} />
                <TxField label="Asking $/SF" value={tx.asking_price_per_sf ? `$${tx.asking_price_per_sf.toFixed(0)}` : null} />
                <TxField label="Asking Cap" value={tx.asking_cap_rate ? `${tx.asking_cap_rate.toFixed(2)}%` : null} />
                <TxField label="Days on Market" value={tx.days_on_market?.toString()} />
                <TxField label="Status" value={tx.listing_status} />
              </dl>
            </div>
          )}

          {/* Parties */}
          {hasParties && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parties</h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <TxField label="Buyer" value={tx.buyer_name} />
                <TxField label="Seller" value={tx.seller_name} />
                <TxField label="Broker" value={tx.broker_name} />
                <TxField label="Brokerage" value={tx.broker_company} />
              </dl>
            </div>
          )}

          {/* Financing */}
          {hasFinancing && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Financing</h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <TxField label="Lender" value={tx.lender} />
                <TxField label="Loan Amount" value={formatCurrency(tx.loan_amount)} />
                <TxField label="Loan Type" value={tx.loan_type} />
                <TxField label="Interest Rate" value={tx.interest_rate ? `${tx.interest_rate}%` : null} />
                <TxField label="Maturity" value={formatDate(tx.maturity_date)} />
                {tx.loan_amount && tx.sale_price ? (
                  <TxField label="LTV" value={`${((tx.loan_amount / tx.sale_price) * 100).toFixed(0)}%`} />
                ) : null}
              </dl>
            </div>
          )}

          {/* Source & Notes */}
          {hasMeta && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Source & Notes</h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <TxField label="Source" value={tx.source?.replace('_', ' ')} />
                {tx.notes && (
                  <div className="col-span-full">
                    <dt className="text-xs text-gray-500">Notes</dt>
                    <dd className="text-sm text-gray-700 mt-0.5">{tx.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline field for transaction cards — only renders if value is present
function TxField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-') return null;
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

const ENTITY_TYPE_LABELS: Record<OwnerEntityType, string> = {
  individual: 'Individual',
  llc: 'LLC',
  trust: 'Trust',
  corporation: 'Corporation',
  reit: 'REIT',
  partnership: 'Partnership',
  government: 'Government',
  nonprofit: 'Nonprofit',
  unknown: 'Unknown',
};

const ENTITY_TYPE_COLORS: Record<OwnerEntityType, string> = {
  individual: 'bg-gray-100 text-gray-700',
  llc: 'bg-blue-100 text-blue-700',
  trust: 'bg-purple-100 text-purple-700',
  corporation: 'bg-indigo-100 text-indigo-700',
  reit: 'bg-green-100 text-green-700',
  partnership: 'bg-yellow-100 text-yellow-800',
  government: 'bg-red-100 text-red-700',
  nonprofit: 'bg-teal-100 text-teal-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const SOURCE_COLORS: Record<ResearchSource, string> = {
  ai: 'bg-blue-100 text-blue-700',
  manual: 'bg-gray-100 text-gray-700',
  county_records: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-500',
};

const SOURCE_LABELS: Record<ResearchSource, string> = {
  ai: 'AI Research',
  manual: 'Manual',
  county_records: 'County Records',
  other: 'Other',
};

function OwnerResearchPanel({ propertyId }: { propertyId: string }) {
  const [research, setResearch] = useState<OwnerResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    owner_name: '',
    owner_entity_type: 'unknown' as OwnerEntityType,
    registered_agent: '',
    mailing_address: '',
    phone: '',
    email: '',
    portfolio_estimate: '',
    research_notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const fetchResearch = useCallback(async () => {
    try {
      const data = await api.getOwnerResearch(propertyId);
      setResearch(data.research || []);
    } catch {
      // Silently fail — panel just shows empty
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchResearch();
  }, [fetchResearch]);

  const handleAIResearch = async () => {
    setAiLoading(true);
    setError(null);
    try {
      await api.runAIOwnerResearch(propertyId);
      await fetchResearch();
    } catch (err: any) {
      setError(err.message || 'AI research failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    setError(null);
    try {
      await api.createOwnerResearch(propertyId, {
        ...manualForm,
        portfolio_estimate: manualForm.portfolio_estimate ? parseInt(manualForm.portfolio_estimate, 10) : null,
      });
      setShowManualForm(false);
      setManualForm({
        owner_name: '',
        owner_entity_type: 'unknown',
        registered_agent: '',
        mailing_address: '',
        phone: '',
        email: '',
        portfolio_estimate: '',
        research_notes: '',
      });
      await fetchResearch();
    } catch (err: any) {
      setError(err.message || 'Failed to save research');
    }
  };

  const handleDelete = async (researchId: string) => {
    try {
      await api.deleteOwnerResearch(researchId);
      setResearch((prev) => prev.filter((r) => r.id !== researchId));
    } catch {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Owner Research</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Owner Research ({research.length})</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAIResearch}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Researching...
                </>
              ) : (
                'Research Owner (AI)'
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowManualForm(!showManualForm)}
            >
              {showManualForm ? 'Cancel' : 'Add Manual'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Manual Entry Form */}
        {showManualForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">New Manual Research Entry</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Owner Name</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.owner_name}
                  onChange={(e) => setManualForm((f) => ({ ...f, owner_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
                <select
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.owner_entity_type}
                  onChange={(e) => setManualForm((f) => ({ ...f, owner_entity_type: e.target.value as OwnerEntityType }))}
                >
                  {Object.entries(ENTITY_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Registered Agent</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.registered_agent}
                  onChange={(e) => setManualForm((f) => ({ ...f, registered_agent: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mailing Address</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.mailing_address}
                  onChange={(e) => setManualForm((f) => ({ ...f, mailing_address: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.email}
                  onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Est. Portfolio Size</label>
                <input
                  type="number"
                  className="w-full border rounded-md px-3 py-1.5 text-sm"
                  value={manualForm.portfolio_estimate}
                  onChange={(e) => setManualForm((f) => ({ ...f, portfolio_estimate: e.target.value }))}
                  placeholder="# properties"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Research Notes</label>
              <textarea
                className="w-full border rounded-md px-3 py-1.5 text-sm"
                rows={3}
                value={manualForm.research_notes}
                onChange={(e) => setManualForm((f) => ({ ...f, research_notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleManualSubmit}>Save Entry</Button>
            </div>
          </div>
        )}

        {/* Research Timeline */}
        {research.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">
            No owner research yet. Click "Research Owner (AI)" to analyze the owner or add a manual entry.
          </p>
        ) : (
          <div className="space-y-4">
            {research.map((entry) => (
              <ResearchEntry key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResearchEntry({ entry, onDelete }: { entry: OwnerResearch; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const rawData = entry.raw_data || {};
  const recommendations = rawData.outreach_recommendations || [];
  const redFlags = rawData.red_flags || [];
  const opportunities = rawData.opportunities || [];

  return (
    <div className="border rounded-lg p-4">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[entry.research_source]}`}>
            {SOURCE_LABELS[entry.research_source]}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ENTITY_TYPE_COLORS[entry.owner_entity_type]}`}>
            {ENTITY_TYPE_LABELS[entry.owner_entity_type]}
          </span>
          {entry.portfolio_estimate != null && (
            <span className="text-xs text-gray-500">
              ~{entry.portfolio_estimate} properties
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{formatDate(entry.created_at)}</span>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-gray-400 hover:text-red-500 text-xs"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Owner name */}
      {entry.owner_name && (
        <p className="text-sm font-semibold text-gray-900 mb-1">{entry.owner_name}</p>
      )}

      {/* AI Summary */}
      {entry.ai_summary && (
        <p className="text-sm text-gray-700 mb-2">{entry.ai_summary}</p>
      )}

      {/* Contact info for manual entries */}
      {(entry.mailing_address || entry.phone || entry.email || entry.registered_agent) && (
        <div className="flex gap-4 text-xs text-gray-500 mb-2 flex-wrap">
          {entry.registered_agent && <span>Agent: {entry.registered_agent}</span>}
          {entry.mailing_address && <span>Mailing: {entry.mailing_address}</span>}
          {entry.phone && <span>Phone: {entry.phone}</span>}
          {entry.email && <span>Email: {entry.email}</span>}
        </div>
      )}

      {/* Expandable analysis */}
      {(entry.research_notes || recommendations.length > 0 || redFlags.length > 0 || opportunities.length > 0) && (
        <>
          <button
            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show details'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              {/* Analysis text */}
              {entry.research_notes && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-600 mb-1">Analysis</h5>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.research_notes}</p>
                </div>
              )}

              {/* Outreach recommendations */}
              {recommendations.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-600 mb-1">Outreach Recommendations</h5>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red flags */}
              {redFlags.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-red-600 mb-1">Red Flags</h5>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {redFlags.map((flag: string, i: number) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Opportunities */}
              {opportunities.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-green-600 mb-1">Opportunities</h5>
                  <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                    {opportunities.map((opp: string, i: number) => (
                      <li key={i}>{opp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MasterPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMgmtModal, setShowMgmtModal] = useState(false);
  const [mgmtSaving, setMgmtSaving] = useState(false);
  const [mgmtForm, setMgmtForm] = useState({
    management_tier: 'asset_management' as ManagementTier,
    management_fee_percent: '',
    management_start_date: new Date().toISOString().split('T')[0],
    management_notes: '',
  });

  useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Not authenticated. Please log in.');
          return;
        }

        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${apiBase}/master-properties/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch property');

        setProperty(data.property);
        setTransactions(data.transactions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load property');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProperty();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            <p className="text-gray-500 mt-2">Loading property...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !property) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button variant="outline" onClick={() => navigate('/data-hub')}>Back to Data Hub</Button>
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error || 'Property not found'}
          </div>
        </div>
      </Layout>
    );
  }

  const latestTx = transactions[0] || null;

  // Section visibility checks
  const showIdentification = hasAnyValue(property, ['property_name', 'building_park', 'apn', 'costar_id', 'crexi_id', 'unit_suite']);
  const showClassification = hasAnyValue(property, ['building_class', 'building_status', 'zoning', 'property_subtype', 'submarket', 'market']);
  const showSizeStructure = hasAnyValue(property, ['building_size', 'land_area_sf', 'lot_size_acres', 'typical_floor_size', 'number_of_floors', 'number_of_units', 'number_of_buildings']);
  const showConstruction = hasAnyValue(property, ['year_built', 'month_built', 'year_renovated', 'month_renovated', 'construction_material']);
  const showIndustrial = hasAnyValue(property, ['clear_height_ft', 'dock_doors', 'grade_doors', 'rail_served', 'column_spacing', 'sprinkler_type', 'number_of_cranes', 'power', 'office_percentage', 'office_space', 'number_of_elevators']);
  const showParking = hasAnyValue(property, ['parking_spaces', 'parking_ratio']);
  const showLeasing = hasAnyValue(property, ['percent_leased', 'vacancy_percent', 'days_on_market', 'rent_per_sf', 'avg_weighted_rent']);
  const showLocation = hasAnyValue(property, ['cross_street', 'opportunity_zone', 'latitude', 'longitude']);
  const showPropertyDetails = showIdentification || showClassification || showSizeStructure || showConstruction || showIndustrial || showParking || showLeasing || showLocation;

  const ownerKeys: (keyof PropertyData)[] = ['owner_name', 'owner_contact', 'owner_address', 'owner_phone', 'mailing_city', 'mailing_state', 'mailing_zip', 'mailing_care_of', 'parent_company', 'fund_name'];
  const showOwner = hasAnyValue(property, ownerKeys);

  const mgmtKeys: (keyof PropertyData)[] = ['property_manager_name', 'property_manager_phone', 'leasing_company_name', 'leasing_company_contact', 'leasing_company_phone', 'developer_name', 'architect_name'];
  const showMgmt = hasAnyValue(property, mgmtKeys);

  const taxKeys: (keyof PropertyData)[] = ['improvement_value', 'land_value', 'total_parcel_value', 'parcel_value_type', 'tax_year', 'annual_tax_bill'];
  const showTax = hasAnyValue(property, taxKeys);

  const utilityKeys: (keyof PropertyData)[] = ['water', 'sewer', 'gas', 'amenities', 'features'];
  const showUtilities = hasAnyValue(property, utilityKeys);

  return (
    <Layout>
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs items={[
            { label: 'Property Database', href: '/data-hub' },
            { label: property.address || 'Property' },
          ]} />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
                {property.property_type && (
                  <Badge variant="info" className="capitalize">{property.property_type}</Badge>
                )}
                {(property as any).is_managed && (
                  <Badge variant="success">Managed</Badge>
                )}
              </div>
              <p className="text-gray-500">
                {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
                {property.county ? ` | ${property.county} County` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {(property as any).is_managed ? (
                <>
                  <Link to={`/asset-services/${id}`}>
                    <Button variant="outline">View in Asset Services</Button>
                  </Link>
                  <Button variant="outline" onClick={async () => {
                    if (!confirm('Disable management for this property?')) return;
                    try {
                      await api.updatePropertyManagement(id!, { is_managed: false, management_tier: null });
                      setProperty(prev => prev ? { ...prev, is_managed: false, management_tier: null } as any : null);
                    } catch (err) { console.error(err); }
                  }}>
                    Disable Management
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowMgmtModal(true)}>Enable Management</Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Key Metrics — 6 cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Building Size</p>
              <p className="text-lg font-bold text-gray-900">
                {property.building_size ? `${formatNumber(property.building_size)} SF` : '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Land / Lot Size</p>
              <p className="text-lg font-bold text-gray-900">
                {property.lot_size_acres != null
                  ? `${property.lot_size_acres} ac`
                  : property.land_area_sf
                    ? `${formatNumber(property.land_area_sf)} SF`
                    : '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Year Built</p>
              <p className="text-lg font-bold text-gray-900">{property.year_built || '-'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Leased</p>
              <p className="text-lg font-bold text-gray-900">
                {property.percent_leased != null ? `${property.percent_leased}%` : '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Latest Sale Price</p>
              <p className="text-lg font-bold text-gray-900">
                {latestTx?.sale_price ? formatCurrency(latestTx.sale_price) : '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">
                {latestTx?.cap_rate ? 'Cap Rate' : '$/SF'}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {latestTx?.cap_rate
                  ? `${latestTx.cap_rate.toFixed(2)}%`
                  : latestTx?.price_per_sf
                    ? `$${latestTx.price_per_sf.toFixed(0)}`
                    : '-'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Property Details — organized sub-sections */}
        {showPropertyDetails && (
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Identification */}
              {showIdentification && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identification</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Property Name" value={property.property_name} />
                    <Field label="Building Park" value={property.building_park} />
                    <Field label="APN" value={property.apn} />
                    <Field label="CoStar ID" value={property.costar_id} />
                    <Field label="Crexi ID" value={property.crexi_id} />
                    <Field label="Unit / Suite" value={property.unit_suite} />
                  </dl>
                </div>
              )}

              {/* Classification */}
              {showClassification && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Classification</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Building Class" value={property.building_class} />
                    <Field label="Building Status" value={property.building_status} />
                    <Field label="Zoning" value={property.zoning} />
                    <Field label="Property Subtype" value={property.property_subtype} />
                    <Field label="Submarket" value={property.submarket} />
                    <Field label="Market" value={property.market} />
                  </dl>
                </div>
              )}

              {/* Size & Structure */}
              {showSizeStructure && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Size & Structure</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Building Size (SF)" value={property.building_size ? formatNumber(property.building_size) : undefined} />
                    <Field label="Land Area (SF)" value={property.land_area_sf ? formatNumber(property.land_area_sf) : undefined} />
                    <Field label="Lot Size (Acres)" value={property.lot_size_acres} />
                    <Field label="Typical Floor Size" value={property.typical_floor_size ? formatNumber(property.typical_floor_size) : undefined} />
                    <Field label="Floors" value={property.number_of_floors} />
                    <Field label="Units" value={property.number_of_units} />
                    <Field label="# Buildings" value={property.number_of_buildings} />
                  </dl>
                </div>
              )}

              {/* Construction */}
              {showConstruction && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Construction</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Year Built" value={property.year_built} />
                    <Field label="Month Built" value={property.month_built} />
                    <Field label="Year Renovated" value={property.year_renovated} />
                    <Field label="Month Renovated" value={property.month_renovated} />
                    <Field label="Construction Material" value={property.construction_material} />
                  </dl>
                </div>
              )}

              {/* Industrial Features */}
              {showIndustrial && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Industrial Features</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Clear Height" value={property.clear_height_ft ? `${property.clear_height_ft} ft` : undefined} />
                    <Field label="Dock Doors" value={property.dock_doors} />
                    <Field label="Grade Doors" value={property.grade_doors} />
                    <Field label="Rail Served" value={property.rail_served} />
                    <Field label="Column Spacing" value={property.column_spacing} />
                    <Field label="Sprinkler Type" value={property.sprinkler_type} />
                    <Field label="# Cranes" value={property.number_of_cranes} />
                    <Field label="Power" value={property.power} />
                    <Field label="Office %" value={property.office_percentage != null ? `${property.office_percentage}%` : undefined} />
                    <Field label="Office Space (SF)" value={property.office_space ? formatNumber(property.office_space) : undefined} />
                    <Field label="# Elevators" value={property.number_of_elevators} />
                  </dl>
                </div>
              )}

              {/* Parking */}
              {showParking && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Parking</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Parking Spaces" value={property.parking_spaces} />
                    <Field label="Parking Ratio" value={property.parking_ratio} />
                  </dl>
                </div>
              )}

              {/* Leasing */}
              {showLeasing && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Leasing</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Percent Leased" value={property.percent_leased != null ? `${property.percent_leased}%` : undefined} />
                    <Field label="Vacancy %" value={property.vacancy_percent != null ? `${property.vacancy_percent}%` : undefined} />
                    <Field label="Days on Market" value={property.days_on_market} />
                    <Field label="Rent / SF" value={property.rent_per_sf != null ? `$${property.rent_per_sf.toFixed(2)}` : undefined} />
                    <Field label="Avg Weighted Rent" value={property.avg_weighted_rent != null ? `$${property.avg_weighted_rent.toFixed(2)}` : undefined} />
                  </dl>
                </div>
              )}

              {/* Location */}
              {showLocation && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Location</h4>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Field label="Cross Street" value={property.cross_street} />
                    <Field label="Opportunity Zone" value={property.opportunity_zone} />
                    <Field label="Latitude" value={property.latitude} />
                    <Field label="Longitude" value={property.longitude} />
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Owner & Contacts */}
        {showOwner && (
          <Card>
            <CardHeader>
              <CardTitle>Owner & Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Owner Name" value={property.owner_name} />
                <Field label="Owner Contact" value={property.owner_contact} />
                <Field label="Owner Phone" value={property.owner_phone} />
                <Field label="Owner Address" value={property.owner_address} />
                <Field label="Mailing City" value={property.mailing_city} />
                <Field label="Mailing State" value={property.mailing_state} />
                <Field label="Mailing Zip" value={property.mailing_zip} />
                <Field label="Care Of" value={property.mailing_care_of} />
                <Field label="Parent Company" value={property.parent_company} />
                <Field label="Fund Name" value={property.fund_name} />
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Property Management & Leasing */}
        {showMgmt && (
          <Card>
            <CardHeader>
              <CardTitle>Property Management & Leasing</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Property Manager" value={property.property_manager_name} />
                <Field label="Property Manager Phone" value={property.property_manager_phone} />
                <Field label="Leasing Company" value={property.leasing_company_name} />
                <Field label="Leasing Contact" value={property.leasing_company_contact} />
                <Field label="Leasing Phone" value={property.leasing_company_phone} />
                <Field label="Developer" value={property.developer_name} />
                <Field label="Architect" value={property.architect_name} />
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Owner Research Panel */}
        <OwnerResearchPanel propertyId={property.id} />

        {/* Tax & Valuation */}
        {showTax && (
          <Card>
            <CardHeader>
              <CardTitle>Tax & Valuation</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Improvement Value" value={formatCurrency(property.improvement_value)} />
                <Field label="Land Value" value={formatCurrency(property.land_value)} />
                <Field label="Total Parcel Value" value={formatCurrency(property.total_parcel_value)} />
                <Field label="Parcel Value Type" value={property.parcel_value_type} />
                <Field label="Tax Year" value={property.tax_year} />
                <Field label="Annual Tax Bill" value={formatCurrency(property.annual_tax_bill)} />
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Utilities & Amenities */}
        {showUtilities && (
          <Card>
            <CardHeader>
              <CardTitle>Utilities & Amenities</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Water" value={property.water} />
                <Field label="Sewer" value={property.sewer} />
                <Field label="Gas" value={property.gas} />
                <Field label="Amenities" value={property.amenities} />
                <Field label="Features" value={property.features} />
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Transaction History — Expandable Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No transactions recorded</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <TransactionCard key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="text-xs text-gray-400 text-right">
          Created {formatDate(property.created_at)} | Updated {formatDate(property.updated_at)}
          {property.source ? ` | Source: ${property.source}` : ''}
        </div>
      </div>

      {/* Enable Management Modal */}
      {showMgmtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMgmtModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enable Asset Management</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setMgmtSaving(true);
              try {
                const res = await api.updatePropertyManagement(id!, {
                  is_managed: true,
                  management_tier: mgmtForm.management_tier,
                  management_fee_percent: mgmtForm.management_fee_percent ? Number(mgmtForm.management_fee_percent) : null,
                  management_start_date: mgmtForm.management_start_date || null,
                  management_notes: mgmtForm.management_notes || null,
                });
                setProperty(prev => prev ? { ...prev, ...res.property } : null);
                setShowMgmtModal(false);
              } catch (err) { console.error(err); } finally { setMgmtSaving(false); }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Management Tier *</label>
                <select value={mgmtForm.management_tier} onChange={e => setMgmtForm(f => ({ ...f, management_tier: e.target.value as ManagementTier }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="asset_management">Asset Management (Full Service)</option>
                  <option value="asset_oversight">Asset Oversight</option>
                  <option value="asset_monitoring">Asset Monitoring</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Management Fee %</label>
                  <input type="number" step="0.01" placeholder="e.g. 5.00" value={mgmtForm.management_fee_percent} onChange={e => setMgmtForm(f => ({ ...f, management_fee_percent: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={mgmtForm.management_start_date} onChange={e => setMgmtForm(f => ({ ...f, management_start_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={mgmtForm.management_notes} onChange={e => setMgmtForm(f => ({ ...f, management_notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional notes about the management agreement" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowMgmtModal(false)}>Cancel</Button>
                <Button type="submit" disabled={mgmtSaving} isLoading={mgmtSaving}>Enable Management</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
