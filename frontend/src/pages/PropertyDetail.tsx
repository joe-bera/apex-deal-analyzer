import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      api
        .getProperty(id)
        .then((data: any) => setProperty(data.property))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const formatCurrency = (value: number | null | undefined) =>
    value ? `$${value.toLocaleString()}` : 'N/A';

  const formatNumber = (value: number | null | undefined) =>
    value ? value.toLocaleString() : 'N/A';

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading property...</p>
        </div>
      </Layout>
    );
  }

  if (error || !property) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Property not found'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              ← Back to Properties
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {property.address || 'Property Details'}
            </h1>
            <p className="text-gray-600">
              {[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Basic Info */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Property Type</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {property.property_type || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Subtype</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.subtype || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">APN</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.apn || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Zoning</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.zoning || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          {/* Size & Physical */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Size & Physical</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Building Size</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatNumber(property.building_size)} SF
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Lot Size</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatNumber(property.lot_size)} SF
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Year Built</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.year_built || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Stories</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.stories || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Parking Spaces</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {property.parking_spaces || 'N/A'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Financial Metrics */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Metrics</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Price</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {formatCurrency(property.price)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Price per SF</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(property.price_per_sqft)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">CAP Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {property.cap_rate ? `${(property.cap_rate * 100).toFixed(2)}%` : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">NOI</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(property.noi)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Gross Income</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(property.gross_income)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Operating Expenses</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(property.operating_expenses)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Market & Lease Info */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Market</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.market || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Submarket</dt>
                <dd className="mt-1 text-sm text-gray-900">{property.submarket || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lease Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Occupancy Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {property.occupancy_rate
                    ? `${(property.occupancy_rate * 100).toFixed(0)}%`
                    : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tenant</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {property.additional_data?.tenant_name || 'N/A'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Documents */}
        {property.documents && property.documents.length > 0 && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            <ul className="divide-y divide-gray-200">
              {property.documents.map((doc: any) => (
                <li key={doc.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {doc.document_type?.replace('_', ' ')} •{' '}
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        doc.extraction_status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : doc.extraction_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {doc.extraction_status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
