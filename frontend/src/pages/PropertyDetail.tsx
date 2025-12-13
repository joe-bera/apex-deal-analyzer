import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading property...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg">Property not found</div>
          <Link to="/dashboard" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
            ← Back to Properties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/dashboard" className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block">
                ← Back to Properties
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">
                {property.address || 'Vacant Land'}, {property.city}
              </h1>
              <p className="text-gray-600 mt-1">
                {property.property_type?.replace('_', ' ').toUpperCase()} • {property.state} {property.zip_code}
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || comps.length === 0}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {analyzing ? 'Analyzing...' : 'Run AI Valuation'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Valuation Results */}
            {valuation && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Valuation Analysis</h2>

                <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Estimated Market Value</div>
                    <div className="text-4xl font-bold text-primary-900">{formatCurrency(valuation.estimated_value)}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      Range: {formatCurrency(valuation.value_range?.low)} - {formatCurrency(valuation.value_range?.high)}
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-1">
                      Confidence: {valuation.confidence_level}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Analysis</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{valuation.analysis}</p>
                  </div>

                  {valuation.key_findings && valuation.key_findings.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {valuation.key_findings.map((finding, i) => (
                          <li key={i} className="text-gray-700">{finding}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {valuation.recommendations && valuation.recommendations.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Recommendations</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {valuation.recommendations.map((rec, i) => (
                          <li key={i} className="text-gray-700">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {valuation.market_insights && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Market Insights</h3>
                      <p className="text-gray-700">{valuation.market_insights}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comparable Sales */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Comparable Sales ({comps.length})</h2>
                <button
                  onClick={() => setShowAddComp(!showAddComp)}
                  className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  {showAddComp ? 'Cancel' : '+ Add Comp'}
                </button>
              </div>

              {showAddComp && (
                <form onSubmit={handleAddComp} className="bg-gray-50 rounded-lg p-4 mb-4 border">
                  <div className="grid grid-cols-2 gap-4">
                    <input name="address" required placeholder="Address *" className="border rounded px-3 py-2" />
                    <input name="city" required placeholder="City *" className="border rounded px-3 py-2" />
                    <input name="state" required placeholder="State *" maxLength={2} className="border rounded px-3 py-2" />
                    <input name="zip" placeholder="Zip Code" className="border rounded px-3 py-2" />
                    <select name="type" required className="border rounded px-3 py-2">
                      <option value="">Property Type *</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="distribution_center">Distribution Center</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="flex_space">Flex Space</option>
                      <option value="land">Land</option>
                      <option value="office">Office</option>
                      <option value="retail">Retail</option>
                      <option value="industrial">Industrial</option>
                    </select>
                    <input name="sqft" type="number" placeholder="Square Feet" className="border rounded px-3 py-2" />
                    <input name="year" type="number" placeholder="Year Built" className="border rounded px-3 py-2" />
                    <input name="price" type="number" step="0.01" required placeholder="Sale Price *" className="border rounded px-3 py-2" />
                    <input name="date" type="date" required className="border rounded px-3 py-2" />
                    <input name="pricesf" type="number" step="0.01" placeholder="Price/SF" className="border rounded px-3 py-2" />
                  </div>
                  <button type="submit" className="mt-4 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition-colors font-medium">
                    Add Comparable
                  </button>
                </form>
              )}

              {comps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No comparable sales added yet. Add comps to run valuation analysis.
                </div>
              ) : (
                <div className="space-y-3">
                  {comps.map((comp) => (
                    <div key={comp.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-900">{comp.comp_address}</div>
                          <div className="text-sm text-gray-600">
                            {comp.comp_city}, {comp.comp_state} • {comp.comp_property_type}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div><span className="text-gray-600">Sale Price:</span> <span className="font-medium">{formatCurrency(comp.comp_sale_price)}</span></div>
                            <div><span className="text-gray-600">Sale Date:</span> {new Date(comp.comp_sale_date).toLocaleDateString()}</div>
                            {comp.comp_square_footage && (
                              <div><span className="text-gray-600">Size:</span> {formatNumber(comp.comp_square_footage)} SF</div>
                            )}
                            {comp.comp_price_per_sqft && (
                              <div><span className="text-gray-600">Price/SF:</span> ${comp.comp_price_per_sqft}/SF</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteComp(comp.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property Details */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Property Details</h2>
              <div className="space-y-3 text-sm">
                {property.apn && (
                  <div>
                    <div className="text-gray-600">APN</div>
                    <div className="font-medium">{property.apn}</div>
                  </div>
                )}
                {property.building_size && (
                  <div>
                    <div className="text-gray-600">Building Size</div>
                    <div className="font-medium">{formatNumber(property.building_size)} SF</div>
                  </div>
                )}
                {property.lot_size && (
                  <div>
                    <div className="text-gray-600">Lot Size</div>
                    <div className="font-medium">{property.lot_size} acres</div>
                  </div>
                )}
                {property.year_built && (
                  <div>
                    <div className="text-gray-600">Year Built</div>
                    <div className="font-medium">{property.year_built}</div>
                  </div>
                )}
                {property.price && (
                  <div>
                    <div className="text-gray-600">List Price</div>
                    <div className="font-medium text-lg">{formatCurrency(property.price)}</div>
                  </div>
                )}
                {property.price_per_sqft && (
                  <div>
                    <div className="text-gray-600">Price per SF</div>
                    <div className="font-medium">${property.price_per_sqft}/SF</div>
                  </div>
                )}
                {property.cap_rate && (
                  <div>
                    <div className="text-gray-600">Cap Rate</div>
                    <div className="font-medium">{property.cap_rate}%</div>
                  </div>
                )}
                {property.noi && (
                  <div>
                    <div className="text-gray-600">NOI</div>
                    <div className="font-medium">{formatCurrency(property.noi)}</div>
                  </div>
                )}
                {property.market && (
                  <div>
                    <div className="text-gray-600">Market</div>
                    <div className="font-medium">{property.market}</div>
                  </div>
                )}
                {property.submarket && (
                  <div>
                    <div className="text-gray-600">Submarket</div>
                    <div className="font-medium">{property.submarket}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/upload?property_id=${id}`)}
                  className="w-full text-left px-4 py-2 rounded border hover:bg-gray-50 transition-colors"
                >
                  Upload Comp Document
                </button>
                <button
                  onClick={handleDeleteProperty}
                  className="w-full text-left px-4 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete Property
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
