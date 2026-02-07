import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';

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
  year_built?: number;
  year_renovated?: number;
  number_of_floors?: number;
  number_of_units?: number;
  clear_height_ft?: number;
  dock_doors?: number;
  grade_doors?: number;
  rail_served?: boolean;
  parking_spaces?: number;
  parking_ratio?: number;
  percent_leased?: number;
  vacancy_percent?: number;
  days_on_market?: number;
  owner_name?: string;
  owner_address?: string;
  owner_phone?: string;
  source?: string;
  improvement_value?: number;
  land_value?: number;
  total_parcel_value?: number;
  annual_tax_bill?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface Transaction {
  id: string;
  transaction_type: string;
  transaction_date?: string;
  sale_price?: number;
  price_per_sf?: number;
  cap_rate?: number;
  noi?: number;
  buyer_name?: string;
  seller_name?: string;
  tenant_name?: string;
  lease_type?: string;
  lender?: string;
  loan_amount?: number;
  source?: string;
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

export default function MasterPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          <p className="text-gray-500 mt-2">Loading property...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button variant="outline" onClick={() => navigate('/data-hub')}>Back to Data Hub</Button>
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error || 'Property not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
                {property.property_type && (
                  <Badge variant="info" className="capitalize">{property.property_type}</Badge>
                )}
              </div>
              <p className="text-gray-500">
                {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
                {property.county ? ` | ${property.county} County` : ''}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/data-hub')}>
              Back to Data Hub
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Building Size</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(property.building_size)} SF</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Year Built</p>
              <p className="text-xl font-bold text-gray-900">{property.year_built || '-'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Leased</p>
              <p className="text-xl font-bold text-gray-900">
                {property.percent_leased != null ? `${property.percent_leased}%` : '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">Source</p>
              <p className="text-xl font-bold text-gray-900 capitalize">{property.source || 'manual'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Property Name" value={property.property_name} />
              <Field label="Building Park" value={property.building_park} />
              <Field label="APN" value={property.apn} />
              <Field label="Submarket" value={property.submarket || property.market} />
              <Field label="Building Class" value={property.building_class} />
              <Field label="Building Status" value={property.building_status} />
              <Field label="Zoning" value={property.zoning} />
              <Field label="Property Subtype" value={property.property_subtype} />
              <Field label="Land Area (SF)" value={formatNumber(property.land_area_sf)} />
              <Field label="Lot Size (Acres)" value={property.lot_size_acres} />
              <Field label="Floors" value={property.number_of_floors} />
              <Field label="Units" value={property.number_of_units} />
              <Field label="Year Renovated" value={property.year_renovated} />
              <Field label="Clear Height" value={property.clear_height_ft ? `${property.clear_height_ft} ft` : undefined} />
              <Field label="Dock Doors" value={property.dock_doors} />
              <Field label="Grade Doors" value={property.grade_doors} />
              <Field label="Rail Served" value={property.rail_served} />
              <Field label="Parking Spaces" value={property.parking_spaces} />
              <Field label="Parking Ratio" value={property.parking_ratio} />
              <Field label="Vacancy %" value={property.vacancy_percent} />
              <Field label="Days on Market" value={property.days_on_market} />
            </dl>
          </CardContent>
        </Card>

        {/* Owner / Contacts */}
        {(property.owner_name || property.owner_address || property.owner_phone) && (
          <Card>
            <CardHeader>
              <CardTitle>Owner & Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Field label="Owner Name" value={property.owner_name} />
                <Field label="Owner Address" value={property.owner_address} />
                <Field label="Owner Phone" value={property.owner_phone} />
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Tax / Valuation */}
        {(property.improvement_value || property.land_value || property.total_parcel_value || property.annual_tax_bill) && (
          <Card>
            <CardHeader>
              <CardTitle>Tax & Valuation</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                <Field label="Improvement Value" value={formatCurrency(property.improvement_value)} />
                <Field label="Land Value" value={formatCurrency(property.land_value)} />
                <Field label="Total Parcel Value" value={formatCurrency(property.total_parcel_value)} />
                <Field label="Annual Tax Bill" value={formatCurrency(property.annual_tax_bill)} />
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No transactions recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Price</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">$/SF</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Cap Rate</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">NOI</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Buyer/Tenant</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Seller</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Badge variant={tx.transaction_type === 'sale' ? 'success' : 'info'} className="capitalize">
                            {tx.transaction_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(tx.transaction_date)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(tx.sale_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {tx.price_per_sf ? `$${tx.price_per_sf.toFixed(0)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {tx.cap_rate ? `${tx.cap_rate.toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(tx.noi)}</td>
                        <td className="px-4 py-3 text-gray-600">{tx.buyer_name || tx.tenant_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{tx.seller_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="text-xs text-gray-400 text-right">
          Created {formatDate(property.created_at)} | Updated {formatDate(property.updated_at)}
        </div>
      </div>
    </div>
  );
}
