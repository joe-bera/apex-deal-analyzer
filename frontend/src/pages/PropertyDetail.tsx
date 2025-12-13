import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import type {
  Property,
  Comp,
  ValuationResult,
  PropertyResponse,
  CompsResponse,
  ValuationResponse,
  CreateCompInput,
  PropertyType,
} from '../types';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  PropertyTypeBadge,
  StatsCard,
  Metric,
  Input,
  Select,
  EmptyState,
} from '../components/ui';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadPropertyData();
    }
  }, [id]);

  const loadPropertyData = async () => {
    try {
      setLoading(true);
      const [propData, compsData] = await Promise.all([
        api.getProperty(id!),
        api.getComps(id!),
      ]);
      setProperty((propData as PropertyResponse).property);
      setComps((compsData as CompsResponse).comps || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load property';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (comps.length === 0) {
      setError('Please add at least one comparable sale before running analysis.');
      return;
    }

    try {
      setAnalyzing(true);
      setError('');
      const result = await api.analyzeProperty(id!);
      setValuation((result as ValuationResponse).valuation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddComp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const compData: CreateCompInput = {
      comp_address: formData.get('address') as string,
      comp_city: formData.get('city') as string,
      comp_state: formData.get('state') as string,
      comp_zip_code: (formData.get('zip') as string) || undefined,
      comp_property_type: formData.get('type') as PropertyType,
      comp_square_footage: formData.get('sqft') ? parseInt(formData.get('sqft') as string) : null,
      comp_year_built: formData.get('year') ? parseInt(formData.get('year') as string) : null,
      comp_sale_price: parseFloat(formData.get('price') as string),
      comp_sale_date: formData.get('date') as string,
      comp_price_per_sqft: formData.get('pricesf') ? parseFloat(formData.get('pricesf') as string) : null,
    };

    try {
      await api.addComp(id!, compData);
      await loadPropertyData();
      setShowAddComp(false);
      e.currentTarget.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add comp';
      setError(message);
    }
  };

  const handleDeleteComp = async (compId: string) => {
    if (!window.confirm('Delete this comp?')) return;

    try {
      await api.deleteComp(compId);
      await loadPropertyData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete comp';
      setError(message);
    }
  };

  const handleDeleteProperty = async () => {
    if (!window.confirm('Delete this property? This action cannot be undone.')) return;

    try {
      await api.deleteProperty(id!);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete property';
      setError(message);
    }
  };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value?: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading property details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!property) {
    return (
      <Layout>
        <EmptyState
          title="Property not found"
          description="The property you're looking for doesn't exist or may have been deleted."
          action={{
            label: 'Back to Portfolio',
            onClick: () => navigate('/dashboard'),
          }}
          icon={
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb & Header */}
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 transition-colors mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Portfolio
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {property.property_type && (
                  <PropertyTypeBadge type={property.property_type} />
                )}
                {property.market && (
                  <Badge variant="default">{property.market}</Badge>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {property.address || 'Vacant Land'}
              </h1>
              <p className="text-gray-500 mt-1">
                {[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/upload?property_id=${id}`)}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
              >
                Upload Document
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || comps.length === 0}
                isLoading={analyzing}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
              >
                {analyzing ? 'Analyzing...' : 'Run AI Valuation'}
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="List Price"
            value={formatCurrency(property.price)}
            variant="highlight"
            icon={
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatsCard
            label="CAP Rate"
            value={property.cap_rate ? `${property.cap_rate}%` : '—'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <StatsCard
            label="Building Size"
            value={property.building_size ? `${formatNumber(property.building_size)} SF` : '—'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatsCard
            label="Price / SF"
            value={property.price_per_sqft ? `$${property.price_per_sqft}` : '—'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        {/* AI Valuation Results */}
        {valuation && (
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>AI Valuation Analysis</CardTitle>
                    <p className="text-sm text-gray-500">Powered by Claude AI</p>
                  </div>
                </div>
                <Badge variant={valuation.confidence_level === 'High' ? 'success' : valuation.confidence_level === 'Medium' ? 'warning' : 'default'} size="md">
                  {valuation.confidence_level} confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Estimated Value Hero */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 mb-6 text-center">
                <p className="text-sm font-medium text-primary-700 mb-1">Estimated Market Value</p>
                <p className="text-4xl font-bold text-primary-900">{formatCurrency(valuation.estimated_value)}</p>
                {valuation.value_range && (
                  <p className="text-sm text-primary-600 mt-2">
                    Range: {formatCurrency(valuation.value_range.low)} - {formatCurrency(valuation.value_range.high)}
                  </p>
                )}
              </div>

              {/* Analysis Text */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Analysis Summary</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{valuation.analysis}</p>
                </div>

                {valuation.key_findings && valuation.key_findings.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Key Findings</h3>
                    <div className="space-y-2">
                      {valuation.key_findings.map((finding, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="mt-1.5 w-1.5 h-1.5 bg-primary-500 rounded-full flex-shrink-0" />
                          <span className="text-gray-700">{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {valuation.recommendations && valuation.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Recommendations</h3>
                    <div className="space-y-2">
                      {valuation.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-700">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {valuation.market_insights && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Market Insights</h3>
                    <p className="text-gray-700">{valuation.market_insights}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Comparable Sales - Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>Comparable Sales</CardTitle>
                    <Badge variant="primary">{comps.length}</Badge>
                  </div>
                  <Button
                    variant={showAddComp ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() => setShowAddComp(!showAddComp)}
                  >
                    {showAddComp ? 'Cancel' : '+ Add Comp'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Add Comp Form */}
                {showAddComp && (
                  <form onSubmit={handleAddComp} className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4">Add Comparable Sale</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input name="address" required placeholder="Address" label="Address *" />
                      <Input name="city" required placeholder="City" label="City *" />
                      <Input name="state" required placeholder="CA" maxLength={2} label="State *" />
                      <Input name="zip" placeholder="Zip Code" label="Zip Code" />
                      <Select
                        name="type"
                        label="Property Type *"
                        options={[
                          { value: 'warehouse', label: 'Warehouse' },
                          { value: 'distribution_center', label: 'Distribution Center' },
                          { value: 'manufacturing', label: 'Manufacturing' },
                          { value: 'flex_space', label: 'Flex Space' },
                          { value: 'land', label: 'Land' },
                          { value: 'office', label: 'Office' },
                          { value: 'retail', label: 'Retail' },
                          { value: 'industrial', label: 'Industrial' },
                        ]}
                        placeholder="Select type"
                      />
                      <Input name="sqft" type="number" placeholder="Square Feet" label="Square Feet" />
                      <Input name="year" type="number" placeholder="2020" label="Year Built" />
                      <Input name="price" type="number" step="0.01" required placeholder="Sale Price" label="Sale Price *" leftAddon="$" />
                      <Input name="date" type="date" required label="Sale Date *" />
                      <Input name="pricesf" type="number" step="0.01" placeholder="Price/SF" label="Price per SF" leftAddon="$" />
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={() => setShowAddComp(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Comparable</Button>
                    </div>
                  </form>
                )}

                {/* Comps List */}
                {comps.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="mx-auto w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-gray-900 font-medium mb-1">No comparable sales yet</h3>
                    <p className="text-gray-500 text-sm mb-4">Add comps to enable AI valuation analysis</p>
                    <Button size="sm" variant="outline" onClick={() => setShowAddComp(true)}>
                      + Add Your First Comp
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comps.map((comp) => (
                      <div
                        key={comp.id}
                        className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">{comp.comp_address}</h4>
                              {comp.comp_property_type && (
                                <PropertyTypeBadge type={comp.comp_property_type} />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mb-3">
                              {comp.comp_city}, {comp.comp_state} {comp.comp_zip_code}
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <Metric label="Sale Price" value={comp.comp_sale_price} format="currency" size="sm" />
                              <Metric label="Sale Date" value={new Date(comp.comp_sale_date).toLocaleDateString()} size="sm" />
                              {comp.comp_square_footage && (
                                <Metric label="Size" value={`${formatNumber(comp.comp_square_footage)} SF`} size="sm" />
                              )}
                              {comp.comp_price_per_sqft && (
                                <Metric label="Price/SF" value={`$${comp.comp_price_per_sqft}`} size="sm" />
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComp(comp.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
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
            {/* Property Details */}
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  {property.apn && (
                    <Metric label="APN" value={property.apn} />
                  )}
                  {property.building_size && (
                    <Metric label="Building Size" value={property.building_size} format="number" />
                  )}
                  {property.lot_size && (
                    <Metric label="Lot Size" value={`${property.lot_size} acres`} />
                  )}
                  {property.year_built && (
                    <Metric label="Year Built" value={property.year_built} />
                  )}
                  {property.noi && (
                    <Metric label="NOI" value={property.noi} format="currency" />
                  )}
                  {property.submarket && (
                    <Metric label="Submarket" value={property.submarket} />
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Permanently delete this property and all associated data.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteProperty}
                  className="w-full"
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  }
                >
                  Delete Property
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
