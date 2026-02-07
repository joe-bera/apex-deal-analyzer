import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BulkUpload from '../components/BulkUpload';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui';

type TabType = 'upload' | 'properties' | 'verification';

interface MasterProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  building_size: number;
  year_built: number;
  percent_leased: number;
  owner_name: string;
  latest_sale_price: number;
  latest_price_per_sf: number;
  latest_cap_rate: number;
  source: string;
  created_at: string;
}

export default function DataHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [properties, setProperties] = useState<MasterProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  const fetchProperties = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please log in.');
        return;
      }

      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      if (search) params.append('search', search);

      const response = await fetch(`${apiBase}/master-properties?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch properties');
      }

      setProperties(data.properties || []);
      setPagination(prev => ({ ...prev, total: data.pagination?.total || 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset]);

  useEffect(() => {
    if (activeTab === 'properties') {
      fetchProperties(searchQuery);
    }
  }, [activeTab, fetchProperties, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, offset: 0 }));
    fetchProperties(searchQuery);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US').format(value);
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'upload',
      label: 'Bulk Upload',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      id: 'properties',
      label: 'Property Database',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'verification',
      label: 'Data Verification',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Data Hub</h1>
              <p className="text-gray-500 mt-1">
                Your centralized CRE property database
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bulk Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import Property Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Upload CSV exports from CoStar, Crexi, LoopNet, or other sources.
                  The system will automatically detect columns and merge with existing data.
                </p>
                <div className="grid grid-cols-4 gap-4 text-center mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">CoStar</p>
                    <p className="text-xs text-blue-600">Full export support</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">Crexi</p>
                    <p className="text-xs text-green-600">Full export support</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-700">LoopNet</p>
                    <p className="text-xs text-purple-600">Basic support</p>
                  </div>
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <p className="text-2xl font-bold text-gray-700">Custom</p>
                    <p className="text-xs text-gray-600">Map any CSV</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <BulkUpload onComplete={() => setActiveTab('properties')} />
          </div>
        )}

        {/* Property Database Tab */}
        {activeTab === 'properties' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Master Property Database</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {pagination.total} properties total
                    </p>
                  </div>
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search address, city, name..."
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
                    />
                    <Button type="submit" variant="outline" size="sm">
                      Search
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProperties(searchQuery)}
                    >
                      Refresh
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading properties...</p>
                  </div>
                ) : properties.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="font-medium">No properties found</p>
                    <p className="text-sm mt-1">
                      Import data from the Bulk Upload tab to get started
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Address</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">City</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Size (SF)</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Year Built</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Sale Price</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">$/SF</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">Cap Rate</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {properties.map((property) => (
                          <tr key={property.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/data-hub/${property.id}`)}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 truncate max-w-[200px]">
                                {property.address}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {property.city}, {property.state}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                {property.property_type || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {formatNumber(property.building_size)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {property.year_built || '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 font-medium">
                              {formatCurrency(property.latest_sale_price)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {property.latest_price_per_sf ? `$${property.latest_price_per_sf.toFixed(0)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {property.latest_cap_rate ? `${property.latest_cap_rate.toFixed(2)}%` : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-gray-500 capitalize">
                                {property.source || 'manual'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {pagination.total > pagination.limit && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-500">
                          Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.offset === 0}
                            onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.offset + pagination.limit >= pagination.total}
                            onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Verification Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Properties that haven't been verified in the past year will appear here.
                  Keep your data fresh by periodically reviewing and updating records.
                </p>
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">No properties need verification</p>
                  <p className="text-sm mt-1">
                    All your data is up to date
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
