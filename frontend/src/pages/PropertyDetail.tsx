import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [comps, setComps] = useState<any[]>([]);
  const [valuation, setValuation] = useState<any>(null);
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
      setProperty(propData.property);
      setComps(compsData.comps || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (comps.length === 0) {
      alert('Please add at least one comparable sale before running analysis.');
      return;
    }

    try {
      setAnalyzing(true);
      setError('');
      const result = await api.analyzeProperty(id!);
      setValuation(result.valuation);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddComp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await api.addComp(id!, {
        comp_address: formData.get('address'),
        comp_city: formData.get('city'),
        comp_state: formData.get('state'),
        comp_zip_code: formData.get('zip'),
        comp_property_type: formData.get('type'),
        comp_square_footage: formData.get('sqft') ? parseInt(formData.get('sqft') as string) : null,
        comp_year_built: formData.get('year') ? parseInt(formData.get('year') as string) : null,
        comp_sale_price: parseFloat(formData.get('price') as string),
        comp_sale_date: formData.get('date'),
        comp_price_per_sqft: formData.get('pricesf') ? parseFloat(formData.get('pricesf') as string) : null,
      });

      await loadPropertyData();
      setShowAddComp(false);
      e.currentTarget.reset();
    } catch (err: any) {
      alert(err.message || 'Failed to add comp');
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value?: number) => {
    if (!value) return 'N/A';
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading property...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Property not found</div>
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
              <Link to="/dashboard" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
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
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {analyzing ? 'Analyzing...' : 'Run AI Valuation'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Valuation Results */}
            {valuation && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Valuation Analysis</h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Estimated Market Value</div>
                    <div className="text-4xl font-bold text-blue-900">{formatCurrency(valuation.estimated_value)}</div>
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
                        {valuation.key_findings.map((finding: string, i: number) => (
                          <li key={i} className="text-gray-700">{finding}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {valuation.recommendations && valuation.recommendations.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Recommendations</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {valuation.recommendations.map((rec: string, i: number) => (
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
                  className="text-blue-600 hover:text-blue-700 font-medium"
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
                  <button type="submit" className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
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
                          onClick={async () => {
                            if (confirm('Delete this comp?')) {
                              await api.deleteComp(comp.id);
                              await loadPropertyData();
                            }
                          }}
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
                  onClick={() => navigate('/upload')}
                  className="w-full text-left px-4 py-2 rounded border hover:bg-gray-50"
                >
                  Upload Document
                </button>
                <button
                  onClick={async () => {
                    if (confirm('Delete this property?')) {
                      await api.deleteProperty(id!);
                      navigate('/dashboard');
                    }
                  }}
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
