import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import type { ManagedPropertySummary } from '../types';

const TIER_LABELS: Record<string, string> = {
  asset_management: 'Asset Management',
  asset_oversight: 'Asset Oversight',
  asset_monitoring: 'Asset Monitoring',
};

const TIER_COLORS: Record<string, string> = {
  asset_management: 'bg-purple-100 text-purple-700',
  asset_oversight: 'bg-blue-100 text-blue-700',
  asset_monitoring: 'bg-gray-100 text-gray-700',
};

export default function AssetServices() {
  const [properties, setProperties] = useState<ManagedPropertySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listManagedProperties();
        setProperties(res.properties || []);
      } catch (err) {
        console.error('Failed to load managed properties:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalUnits = properties.reduce((s, p) => s + (p.active_tenants || 0), 0);
  const totalIncome = properties.reduce((s, p) => s + (p.monthly_rent_income || 0), 0);
  const totalExpenses = properties.reduce((s, p) => s + (p.total_expenses_ytd || 0), 0);
  const avgOccupancy = properties.length
    ? properties.reduce((s, p) => s + (p.occupancy_percent || 0), 0) / properties.length
    : 0;

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Services Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your property management portfolio</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Managed Properties', value: properties.length },
            { label: 'Active Tenants', value: totalUnits },
            { label: 'Avg Occupancy', value: `${avgOccupancy.toFixed(1)}%` },
            { label: 'Monthly Income', value: fmt(totalIncome) },
            { label: 'YTD Expenses', value: fmt(totalExpenses) },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Properties Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading portfolio...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">No managed properties</h3>
            <p className="mt-1 text-sm text-gray-500">
              Go to the Property Database, select a property, and enable management to get started.
            </p>
            <Link
              to="/data-hub"
              className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              Go to Property Database
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Property</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tier</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tenants</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Occupancy</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monthly Income</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">YTD Expenses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {properties.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/asset-services/${p.id}`} className="text-primary-600 hover:text-primary-800 font-medium text-sm">
                          {p.address}
                        </Link>
                        {p.city && <div className="text-xs text-gray-500">{p.city}, {p.state}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {p.management_tier && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[p.management_tier] || 'bg-gray-100 text-gray-700'}`}>
                            {TIER_LABELS[p.management_tier] || p.management_tier}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">{p.active_tenants}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${p.occupancy_percent >= 90 ? 'text-green-600' : p.occupancy_percent >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {p.occupancy_percent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmt(p.monthly_rent_income)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmt(p.total_expenses_ytd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
