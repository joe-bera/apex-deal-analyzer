import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Property } from '../types';
import { Button, Badge, PropertyTypeBadge } from './ui';

type NumericPropertyKey = 'price' | 'cap_rate' | 'price_per_sqft' | 'building_size';

interface PropertyComparisonProps {
  properties: Property[];
  onClose: () => void;
}

export default function PropertyComparison({ properties, onClose }: PropertyComparisonProps) {
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString();
  };

  const toggleProperty = (property: Property) => {
    if (selectedProperties.find(p => p.id === property.id)) {
      setSelectedProperties(selectedProperties.filter(p => p.id !== property.id));
    } else if (selectedProperties.length < 4) {
      setSelectedProperties([...selectedProperties, property]);
    }
  };

  const isSelected = (property: Property) => selectedProperties.some(p => p.id === property.id);

  // Calculate which property has the best value for each metric
  const getBestForMetric = (metric: NumericPropertyKey) => {
    if (selectedProperties.length === 0) return null;

    let best = selectedProperties[0];
    for (const prop of selectedProperties) {
      const propValue = prop[metric] || 0;
      const bestValue = best[metric] || 0;

      if (metric === 'price' || metric === 'price_per_sqft') {
        // Lower is better for price
        if (propValue > 0 && (bestValue === 0 || propValue < bestValue)) {
          best = prop;
        }
      } else {
        // Higher is better for cap_rate and building_size
        if (propValue > bestValue) {
          best = prop;
        }
      }
    }
    return best.id;
  };

  // Comparison metrics
  const metrics = [
    { key: 'price', label: 'List Price', format: formatCurrency, best: 'low' },
    { key: 'cap_rate', label: 'CAP Rate', format: (v: number | null | undefined) => v ? `${v}%` : '—', best: 'high' },
    { key: 'price_per_sqft', label: 'Price/SF', format: (v: number | null | undefined) => v ? `$${v}` : '—', best: 'low' },
    { key: 'building_size', label: 'Building Size', format: (v: number | null | undefined) => v ? `${formatNumber(v)} SF` : '—', best: 'high' },
    { key: 'lot_size', label: 'Lot Size', format: (v: number | null | undefined) => v ? `${formatNumber(v)} SF` : '—', best: 'high' },
    { key: 'year_built', label: 'Year Built', format: (v: number | null | undefined) => v?.toString() || '—', best: 'high' },
    { key: 'noi', label: 'NOI', format: formatCurrency, best: 'high' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Compare Properties</h2>
            <p className="text-sm text-gray-500">
              {showComparison ? 'Side-by-side comparison' : 'Select up to 4 properties to compare side-by-side'}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {!showComparison ? (
            // Property Selection Grid
            <div className="p-6">
              <p className="text-gray-600 mb-4">Click on properties to add them to the comparison:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => toggleProperty(property)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected(property)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{property.address || 'Vacant Land'}</h3>
                        <p className="text-sm text-gray-500 truncate">{property.city}, {property.state}</p>
                      </div>
                      {isSelected(property) && (
                        <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {property.property_type && <PropertyTypeBadge type={property.property_type} />}
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(property.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Comparison Table
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Badge variant="primary">{selectedProperties.length} properties selected</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
                >
                  Change Selection
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600 w-40">Metric</th>
                      {selectedProperties.map((property) => (
                        <th key={property.id} className="text-left py-3 px-4 min-w-48">
                          <div className="space-y-1">
                            <Link
                              to={`/properties/${property.id}`}
                              className="font-semibold text-gray-900 hover:text-primary-600 block truncate"
                            >
                              {property.address || 'Vacant Land'}
                            </Link>
                            <p className="text-sm text-gray-500 truncate">{property.city}, {property.state}</p>
                            {property.property_type && (
                              <PropertyTypeBadge type={property.property_type} />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric) => {
                      const isNumericKey = ['price', 'cap_rate', 'price_per_sqft', 'building_size'].includes(metric.key);
                      const bestId = isNumericKey ? getBestForMetric(metric.key as NumericPropertyKey) : null;
                      return (
                        <tr key={metric.key} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-600">{metric.label}</td>
                          {selectedProperties.map((property) => {
                            const value = property[metric.key as keyof Property] as number | null | undefined;
                            const isBest = property.id === bestId && value;
                            return (
                              <td key={property.id} className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className={`text-lg ${isBest ? 'font-bold text-green-600' : 'text-gray-900'}`}>
                                    {metric.format(value)}
                                  </span>
                                  {isBest && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                      Best
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Market/Submarket Row */}
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-600">Market</td>
                      {selectedProperties.map((property) => (
                        <td key={property.id} className="py-3 px-4 text-gray-900">
                          {property.market || property.submarket || '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Property Type Row */}
                    <tr className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-600">Type</td>
                      {selectedProperties.map((property) => (
                        <td key={property.id} className="py-3 px-4">
                          {property.property_type ? (
                            <PropertyTypeBadge type={property.property_type} />
                          ) : '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Visual Comparison Bars */}
              <div className="mt-8 space-y-6">
                <h3 className="font-semibold text-gray-900">Visual Comparison</h3>

                {/* Price Comparison Bar */}
                {selectedProperties.some(p => p.price) && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Price Comparison</p>
                    <div className="space-y-2">
                      {selectedProperties.map((property) => {
                        const maxPrice = Math.max(...selectedProperties.map(p => p.price || 0));
                        const percentage = property.price ? (property.price / maxPrice) * 100 : 0;
                        return (
                          <div key={property.id} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-32 truncate">{property.address?.substring(0, 15) || 'Property'}</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="text-xs text-white font-medium">{formatCurrency(property.price)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CAP Rate Comparison Bar */}
                {selectedProperties.some(p => p.cap_rate) && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">CAP Rate Comparison</p>
                    <div className="space-y-2">
                      {selectedProperties.map((property) => {
                        const maxCap = Math.max(...selectedProperties.map(p => p.cap_rate || 0));
                        const percentage = property.cap_rate ? (property.cap_rate / maxCap) * 100 : 0;
                        return (
                          <div key={property.id} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-32 truncate">{property.address?.substring(0, 15) || 'Property'}</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="text-xs text-white font-medium">{property.cap_rate}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size Comparison Bar */}
                {selectedProperties.some(p => p.building_size) && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Building Size Comparison</p>
                    <div className="space-y-2">
                      {selectedProperties.map((property) => {
                        const maxSize = Math.max(...selectedProperties.map(p => p.building_size || 0));
                        const percentage = property.building_size ? (property.building_size / maxSize) * 100 : 0;
                        return (
                          <div key={property.id} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-32 truncate">{property.address?.substring(0, 15) || 'Property'}</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="text-xs text-white font-medium">{formatNumber(property.building_size)} SF</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — selection mode: show counter + Compare Now button */}
        {!showComparison && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedProperties.length} of 4 selected
            </span>
            <div className="flex items-center gap-2">
              {selectedProperties.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProperties([])}
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                disabled={selectedProperties.length < 2}
                onClick={() => setShowComparison(true)}
              >
                Compare Now
              </Button>
            </div>
          </div>
        )}

        {/* Footer — comparison mode: add more */}
        {showComparison && selectedProperties.length < 4 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center">
            <button
              onClick={() => setShowComparison(false)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              + Add more properties to compare ({4 - selectedProperties.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
