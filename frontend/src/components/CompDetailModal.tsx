import { useState, useEffect } from 'react';
import type { Comp, Property } from '../types';
import { api } from '../lib/api';
import { Button, Badge, PropertyTypeBadge, Card, CardContent } from './ui';
import StreetViewImage from './StreetViewImage';

interface CompDetailModalProps {
  comp: Comp;
  subjectProperty?: Property;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (comp: Comp) => void;
}

interface Adjustment {
  category: string;
  amount: number;
  note: string;
}

export default function CompDetailModal({
  comp,
  subjectProperty,
  isOpen,
  onClose,
  onUpdate,
}: CompDetailModalProps) {
  const [adjustmentNotes, setAdjustmentNotes] = useState(comp.adjustment_notes || '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comparison' | 'adjustments'>('details');

  // Adjustment calculator state
  const [adjustments, setAdjustments] = useState<Adjustment[]>([
    { category: 'Location', amount: 0, note: '' },
    { category: 'Size', amount: 0, note: '' },
    { category: 'Age/Condition', amount: 0, note: '' },
    { category: 'Other', amount: 0, note: '' },
  ]);

  useEffect(() => {
    setAdjustmentNotes(comp.adjustment_notes || '');
  }, [comp]);

  const handleSaveNotes = async () => {
    if (!onUpdate) return;

    setSaving(true);
    try {
      // Combine adjustment notes with calculator adjustments
      const adjustmentSummary = adjustments
        .filter(a => a.amount !== 0)
        .map(a => `${a.category}: ${a.amount > 0 ? '+' : ''}$${a.amount}/SF${a.note ? ` (${a.note})` : ''}`)
        .join('\n');

      const fullNotes = adjustmentSummary
        ? `${adjustmentSummary}\n\n${adjustmentNotes}`.trim()
        : adjustmentNotes;

      const result: any = await api.updateComp(comp.id, {
        adjustment_notes: fullNotes,
      });
      if (result.comp) {
        onUpdate(result.comp);
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSaving(false);
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

  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const adjustedPricePerSF = (comp.comp_price_per_sqft || 0) + totalAdjustment;

  // Calculate differences from subject property
  const getDifference = (compValue?: number | null, subjectValue?: number | null) => {
    if (compValue == null || subjectValue == null) return null;
    return compValue - subjectValue;
  };

  const priceDiff = getDifference(comp.comp_sale_price, subjectProperty?.price);
  const psfDiff = getDifference(comp.comp_price_per_sqft, subjectProperty?.price_per_sqft);
  const sizeDiff = getDifference(comp.comp_square_footage, subjectProperty?.building_size);
  const ageDiff = getDifference(
    comp.comp_year_built ? new Date().getFullYear() - comp.comp_year_built : null,
    subjectProperty?.year_built ? new Date().getFullYear() - subjectProperty.year_built : null
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slideout Panel - wider for more content */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl z-50 transform transition-transform overflow-y-auto">
        {/* Header with Street View */}
        <div className="relative">
          <StreetViewImage
            address={comp.comp_address}
            city={comp.comp_city}
            state={comp.comp_state}
            zipCode={comp.comp_zip_code}
            width={672}
            height={200}
            className="w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{comp.comp_address}</h2>
                <p className="text-white/80">
                  {comp.comp_city}, {comp.comp_state} {comp.comp_zip_code}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {comp.comp_property_type && (
                    <PropertyTypeBadge type={comp.comp_property_type} />
                  )}
                  {comp.distance_miles && (
                    <Badge variant="default" className="bg-white/20 text-white border-white/30">
                      {comp.distance_miles.toFixed(1)} mi away
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Price Hero */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm">Sale Price</p>
              <p className="text-3xl font-bold">{formatCurrency(comp.comp_sale_price)}</p>
            </div>
            <div className="text-right">
              <p className="text-primary-100 text-sm">Price/SF</p>
              <p className="text-2xl font-bold">
                ${comp.comp_price_per_sqft?.toFixed(2) || 'N/A'}
              </p>
            </div>
            {comp.comp_cap_rate && (
              <div className="text-right">
                <p className="text-primary-100 text-sm">CAP Rate</p>
                <p className="text-2xl font-bold">{comp.comp_cap_rate}%</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {[
              { id: 'details', label: 'Details' },
              { id: 'comparison', label: 'vs Subject' },
              { id: 'adjustments', label: 'Adjustments' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Property Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Building Size</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {comp.comp_square_footage ? `${formatNumber(comp.comp_square_footage)} SF` : 'N/A'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Year Built</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {comp.comp_year_built || 'N/A'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Sale Date</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {new Date(comp.comp_sale_date).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Source</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {comp.source || 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Similarity Score */}
              {comp.similarity_score && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">Similarity Score</p>
                      <span className="text-lg font-bold text-primary-600">{comp.similarity_score}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all"
                        style={{ width: `${comp.similarity_score}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Notes */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <textarea
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    placeholder="Add notes about this comparable..."
                    rows={3}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Comparison Tab */}
          {activeTab === 'comparison' && (
            <div className="space-y-4">
              {!subjectProperty ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No subject property data available for comparison</p>
                </div>
              ) : (
                <>
                  {/* Comparison Table */}
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Metric</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Subject</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comp</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">Price</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(subjectProperty.price)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{formatCurrency(comp.comp_sale_price)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${priceDiff && priceDiff > 0 ? 'text-red-600' : priceDiff && priceDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {priceDiff !== null ? `${priceDiff > 0 ? '+' : ''}${formatCurrency(priceDiff)}` : '—'}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">Price/SF</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">${subjectProperty.price_per_sqft?.toFixed(2) || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">${comp.comp_price_per_sqft?.toFixed(2) || 'N/A'}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${psfDiff && psfDiff > 0 ? 'text-red-600' : psfDiff && psfDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {psfDiff !== null ? `${psfDiff > 0 ? '+' : ''}$${psfDiff.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">Building Size</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatNumber(subjectProperty.building_size)} SF</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{formatNumber(comp.comp_square_footage)} SF</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${sizeDiff && sizeDiff > 0 ? 'text-blue-600' : sizeDiff && sizeDiff < 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {sizeDiff !== null ? `${sizeDiff > 0 ? '+' : ''}${formatNumber(sizeDiff)} SF` : '—'}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">Year Built</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{subjectProperty.year_built || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{comp.comp_year_built || 'N/A'}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${ageDiff && ageDiff > 0 ? 'text-orange-600' : ageDiff && ageDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {ageDiff !== null ? `${ageDiff > 0 ? '+' : ''}${ageDiff} yrs older` : '—'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">CAP Rate</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{subjectProperty.cap_rate ? `${subjectProperty.cap_rate}%` : 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{comp.comp_cap_rate ? `${comp.comp_cap_rate}%` : 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Quick Insights */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">Quick Analysis</h4>
                      <ul className="space-y-1 text-sm text-blue-800">
                        {psfDiff !== null && (
                          <li>
                            • Comp sold for <span className="font-medium">${Math.abs(psfDiff).toFixed(2)}/SF {psfDiff > 0 ? 'more' : 'less'}</span> than subject asking price
                          </li>
                        )}
                        {sizeDiff !== null && (
                          <li>
                            • Comp is <span className="font-medium">{Math.abs(sizeDiff).toLocaleString()} SF {sizeDiff > 0 ? 'larger' : 'smaller'}</span> than subject
                          </li>
                        )}
                        {ageDiff !== null && (
                          <li>
                            • Comp is <span className="font-medium">{Math.abs(ageDiff)} years {ageDiff > 0 ? 'older' : 'newer'}</span> than subject
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Adjustments Tab */}
          {activeTab === 'adjustments' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                Adjust the comp's price per SF to account for differences from the subject property.
              </p>

              {/* Adjustment Calculator */}
              <div className="space-y-4">
                {adjustments.map((adj, idx) => (
                  <div key={adj.category} className="flex items-center gap-3">
                    <div className="w-28 text-sm font-medium text-gray-700">{adj.category}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">$</span>
                      <input
                        type="number"
                        value={adj.amount || ''}
                        onChange={(e) => {
                          const newAdj = [...adjustments];
                          newAdj[idx].amount = parseFloat(e.target.value) || 0;
                          setAdjustments(newAdj);
                        }}
                        placeholder="0"
                        className="w-20 rounded-md border-gray-300 text-sm text-center"
                      />
                      <span className="text-gray-500">/SF</span>
                    </div>
                    <input
                      type="text"
                      value={adj.note}
                      onChange={(e) => {
                        const newAdj = [...adjustments];
                        newAdj[idx].note = e.target.value;
                        setAdjustments(newAdj);
                      }}
                      placeholder="Note (optional)"
                      className="flex-1 rounded-md border-gray-300 text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Adjustment Summary */}
              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Original Price/SF</span>
                      <span className="font-medium">${comp.comp_price_per_sqft?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Adjustment</span>
                      <span className={`font-medium ${totalAdjustment > 0 ? 'text-green-600' : totalAdjustment < 0 ? 'text-red-600' : ''}`}>
                        {totalAdjustment > 0 ? '+' : ''}{totalAdjustment !== 0 ? `$${totalAdjustment.toFixed(2)}` : '$0.00'}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold text-gray-900">Adjusted Price/SF</span>
                      <span className="font-bold text-lg text-primary-600">${adjustedPricePerSF.toFixed(2)}</span>
                    </div>
                    {subjectProperty?.building_size && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Implied Value (Subject SF)</span>
                        <span>{formatCurrency(adjustedPricePerSF * subjectProperty.building_size)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder="Additional comments, market conditions, etc..."
                  rows={4}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            Added {new Date(comp.created_at).toLocaleDateString()}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleSaveNotes}
              isLoading={saving}
              disabled={saving}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
