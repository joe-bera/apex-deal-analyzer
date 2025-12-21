import { useState, useEffect } from 'react';
import type { Comp } from '../types';
import { api } from '../lib/api';
import { Button, Badge, PropertyTypeBadge, Metric, Card, CardContent } from './ui';

interface CompDetailModalProps {
  comp: Comp;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (comp: Comp) => void;
}

export default function CompDetailModal({
  comp,
  isOpen,
  onClose,
  onUpdate,
}: CompDetailModalProps) {
  const [adjustmentNotes, setAdjustmentNotes] = useState(comp.adjustment_notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAdjustmentNotes(comp.adjustment_notes || '');
  }, [comp]);

  const handleSaveNotes = async () => {
    if (!onUpdate) return;

    setSaving(true);
    try {
      const result: any = await api.updateComp(comp.id, {
        adjustment_notes: adjustmentNotes,
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slideout Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 transform transition-transform overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Comparable Sale Details</h2>
            <p className="text-sm text-gray-500">{comp.comp_address}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Location */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Location</h3>
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">{comp.comp_address}</p>
                <p className="text-gray-600">
                  {comp.comp_city}, {comp.comp_state} {comp.comp_zip_code}
                </p>
                {comp.distance_miles && (
                  <Badge variant="default">{comp.distance_miles.toFixed(1)} miles away</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Property Info */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Property Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Property Type</p>
                  {comp.comp_property_type && (
                    <PropertyTypeBadge type={comp.comp_property_type} />
                  )}
                </div>
                <Metric
                  label="Building Size"
                  value={comp.comp_square_footage ? `${formatNumber(comp.comp_square_footage)} SF` : 'N/A'}
                  size="sm"
                />
                <Metric
                  label="Year Built"
                  value={comp.comp_year_built || 'N/A'}
                  size="sm"
                />
                {comp.similarity_score && (
                  <div>
                    <p className="text-sm text-gray-500">Similarity Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-2 bg-primary-600 rounded-full"
                          style={{ width: `${comp.similarity_score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{comp.similarity_score}%</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sale Information */}
          <Card variant="elevated">
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sale Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Sale Price</p>
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(comp.comp_sale_price)}</p>
                </div>
                <Metric
                  label="Sale Date"
                  value={new Date(comp.comp_sale_date).toLocaleDateString()}
                  size="sm"
                />
                <Metric
                  label="Price per SF"
                  value={comp.comp_price_per_sqft ? `$${comp.comp_price_per_sqft.toFixed(2)}` : 'N/A'}
                  size="sm"
                />
                {comp.comp_cap_rate && (
                  <Metric
                    label="CAP Rate"
                    value={`${comp.comp_cap_rate}%`}
                    size="sm"
                  />
                )}
                {comp.source && (
                  <Metric
                    label="Source"
                    value={comp.source}
                    size="sm"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Adjustment Notes */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Adjustment Notes
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Record adjustments for differences in size, age, location, condition, etc.
              </p>
              <textarea
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="e.g., +$5/SF for superior location, -$3/SF for older building age..."
                rows={4}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  isLoading={saving}
                  disabled={saving || adjustmentNotes === (comp.adjustment_notes || '')}
                >
                  Save Notes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <div className="text-xs text-gray-400 text-center">
            Added {new Date(comp.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </>
  );
}
