import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import type { Property, PropertiesResponse } from '../types';
import {
  Button,
  StatsCard,
  SearchInput,
  Select,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PropertyCard,
  PropertyCardCompact,
  EmptyState,
  PropertyCardSkeleton,
  StatsSkeleton,
} from '../components/ui';
import { PortfolioCharts } from '../components/charts';
import PropertyComparison from '../components/PropertyComparison';

type ViewMode = 'grid' | 'list' | 'analytics';
type SortOption = 'newest' | 'price-high' | 'price-low' | 'cap-rate' | 'size';

export default function Dashboard() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showComparison, setShowComparison] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'choose' | 'manual'>('choose');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    api
      .listProperties()
      .then((data) => {
        const response = data as PropertiesResponse;
        setProperties(response.properties || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');

    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      address: fd.get('address') as string,
      city: fd.get('city') as string,
      state: (fd.get('state') as string) || 'CA',
      zip_code: fd.get('zip_code') as string || undefined,
      property_type: fd.get('property_type') as string || undefined,
      building_size: fd.get('building_size') ? Number(fd.get('building_size')) : undefined,
      lot_size: fd.get('lot_size') ? Number(fd.get('lot_size')) : undefined,
      year_built: fd.get('year_built') ? Number(fd.get('year_built')) : undefined,
      price: fd.get('price') ? Number(fd.get('price')) : undefined,
      cap_rate: fd.get('cap_rate') ? Number(fd.get('cap_rate')) : undefined,
      apn: fd.get('apn') as string || undefined,
    };
    // Remove undefined values
    Object.keys(body).forEach((k) => { if (body[k] === undefined || body[k] === '') delete body[k]; });

    try {
      const result: any = await api.createProperty(body);
      setShowAddModal(false);
      navigate(`/properties/${result.property.id}`);
    } catch (err: any) {
      setAddError(err.message || 'Failed to create property');
    } finally {
      setAddSaving(false);
    }
  };

  // Calculate portfolio stats with health metrics
  const stats = useMemo(() => {
    if (properties.length === 0) {
      return {
        totalProperties: 0,
        totalValue: 0,
        avgCapRate: 0,
        totalSqft: 0,
        avgPriceSf: 0,
        portfolioHealth: 0,
        diversificationScore: 0,
        propertiesWithComps: 0,
        propertiesAnalyzed: 0,
      };
    }

    const totalValue = properties.reduce((sum, p) => sum + (p.price || 0), 0);
    const capRates = properties.filter((p) => p.cap_rate).map((p) => p.cap_rate!);
    const avgCapRate = capRates.length > 0
      ? capRates.reduce((sum, rate) => sum + rate, 0) / capRates.length
      : 0;
    const totalSqft = properties.reduce((sum, p) => sum + (p.building_size || 0), 0);
    const avgPriceSf = totalSqft > 0 ? totalValue / totalSqft : 0;

    // Calculate portfolio health metrics
    const uniqueTypes = new Set(properties.map(p => p.property_type).filter(Boolean));
    const uniqueMarkets = new Set(properties.map(p => p.market || p.city).filter(Boolean));

    // Diversification score: based on property types and markets
    const typeDiversity = Math.min((uniqueTypes.size / 5) * 50, 50); // Max 50 points for 5+ types
    const marketDiversity = Math.min((uniqueMarkets.size / 3) * 50, 50); // Max 50 points for 3+ markets
    const diversificationScore = typeDiversity + marketDiversity;

    // Data completeness score
    const propertiesWithPrice = properties.filter(p => p.price).length;
    const propertiesWithSize = properties.filter(p => p.building_size).length;
    const propertiesWithCapRate = properties.filter(p => p.cap_rate).length;
    const dataCompleteness = ((propertiesWithPrice + propertiesWithSize + propertiesWithCapRate) / (properties.length * 3)) * 100;

    // Overall portfolio health (weighted average)
    const portfolioHealth = Math.round((diversificationScore * 0.4) + (dataCompleteness * 0.6));

    return {
      totalProperties: properties.length,
      totalValue,
      avgCapRate,
      totalSqft,
      avgPriceSf,
      portfolioHealth,
      diversificationScore: Math.round(diversificationScore),
      propertiesWithComps: propertiesWithCapRate, // Using cap rate as proxy for analyzed
      propertiesAnalyzed: propertiesWithCapRate,
    };
  }, [properties]);

  // Get unique property types for filter
  const propertyTypes = useMemo(() => {
    const types = new Set(properties.map((p) => p.property_type).filter(Boolean));
    return Array.from(types).map((type) => ({
      value: type!,
      label: type!.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }, [properties]);

  // Filter and sort properties
  const filteredProperties = useMemo(() => {
    let result = [...properties];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.address?.toLowerCase().includes(query) ||
          p.city?.toLowerCase().includes(query) ||
          p.state?.toLowerCase().includes(query) ||
          p.market?.toLowerCase().includes(query)
      );
    }

    // Property type filter
    if (propertyTypeFilter) {
      result = result.filter((p) => p.property_type === propertyTypeFilter);
    }

    // Sort
    switch (sortBy) {
      case 'price-high':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'price-low':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'cap-rate':
        result.sort((a, b) => (b.cap_rate || 0) - (a.cap_rate || 0));
        break;
      case 'size':
        result.sort((a, b) => (b.building_size || 0) - (a.building_size || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
    }

    return result;
  }, [properties, searchQuery, propertyTypeFilter, sortBy]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toLocaleString();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Deals</h1>
            <p className="text-gray-500 mt-1">
              Manage and analyze your commercial real estate deals
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/data-hub')}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              }
            >
              Property Database
            </Button>
            {properties.length >= 2 && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowComparison(true)}
                leftIcon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                Compare
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => { setShowAddModal(true); setAddMode('choose'); setAddError(''); }}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Add Property
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsSkeleton />
            <StatsSkeleton />
            <StatsSkeleton />
            <StatsSkeleton />
          </div>
        ) : properties.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                label="Total Properties"
                value={stats.totalProperties}
                icon={
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <StatsCard
                label="Portfolio Value"
                value={formatCurrency(stats.totalValue)}
                variant="highlight"
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatsCard
                label="Avg CAP Rate"
                value={stats.avgCapRate > 0 ? `${stats.avgCapRate.toFixed(2)}%` : '—'}
                icon={
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <StatsCard
                label="Total Square Feet"
                value={`${formatNumber(stats.totalSqft)} SF`}
                icon={
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                }
              />
            </div>

            {/* Portfolio Health Card */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 text-white">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke={stats.portfolioHealth >= 70 ? '#10B981' : stats.portfolioHealth >= 40 ? '#F59E0B' : '#EF4444'}
                        strokeWidth="6"
                        strokeDasharray={`${(stats.portfolioHealth / 100) * 175.93} 175.93`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                      {stats.portfolioHealth}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Portfolio Health Score</h3>
                    <p className="text-gray-400 text-sm">
                      {stats.portfolioHealth >= 70 ? 'Excellent' : stats.portfolioHealth >= 40 ? 'Good' : 'Needs Attention'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Avg Price/SF</p>
                    <p className="text-xl font-semibold">${stats.avgPriceSf.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Analyzed</p>
                    <p className="text-xl font-semibold">{stats.propertiesAnalyzed}/{stats.totalProperties}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Diversification</p>
                    <p className="text-xl font-semibold">{stats.diversificationScore}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Data Quality</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${stats.portfolioHealth >= 70 ? 'bg-green-500' : stats.portfolioHealth >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${stats.portfolioHealth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Filters & Search */}
        {!loading && properties.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by address, city, or market..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
              />
            </div>
            <div className="flex gap-3">
              <Select
                options={[
                  { value: '', label: 'All Types' },
                  ...propertyTypes,
                ]}
                value={propertyTypeFilter}
                onChange={(e) => setPropertyTypeFilter(e.target.value)}
                className="w-40"
              />
              <Select
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'price-high', label: 'Price: High to Low' },
                  { value: 'price-low', label: 'Price: Low to High' },
                  { value: 'cap-rate', label: 'CAP Rate' },
                  { value: 'size', label: 'Size' },
                ]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-44"
              />
              {/* View Toggle */}
              <div className="hidden sm:flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  title="Grid view"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  title="List view"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`p-2 ${viewMode === 'analytics' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  title="Analytics view"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        {!loading && properties.length > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {filteredProperties.length} of {properties.length} properties
            </span>
          </div>
        )}

        {/* Property Grid/List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
          </div>
        ) : properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Get started by uploading a property document. We'll extract key information and help you analyze the deal."
            action={{
              label: 'Upload Your First Property',
              onClick: () => navigate('/upload'),
            }}
            icon={
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
        ) : filteredProperties.length === 0 ? (
          <EmptyState
            title="No matching properties"
            description="Try adjusting your search or filters to find what you're looking for."
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('');
                setPropertyTypeFilter('');
              },
            }}
            icon={
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        ) : viewMode === 'analytics' ? (
          <PortfolioCharts properties={properties} />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProperties.map((property) => (
              <PropertyCardCompact key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>

      {/* Property Comparison Modal */}
      {showComparison && (
        <PropertyComparison
          properties={properties}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{addMode === 'choose' ? 'Add Property' : 'New Property'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {addMode === 'choose' ? (
                <div className="space-y-3">
                  <button
                    onClick={() => { setShowAddModal(false); navigate('/upload'); }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                  >
                    <div className="p-3 bg-primary-100 rounded-lg flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Upload a Document</p>
                      <p className="text-sm text-gray-500">Upload a PDF and auto-extract property data</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setAddMode('manual')}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                  >
                    <div className="p-3 bg-gray-100 rounded-lg flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Enter Manually</p>
                      <p className="text-sm text-gray-500">Type in property details by hand</p>
                    </div>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                      {addError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Input name="address" required label="Address *" placeholder="123 Industrial Blvd" />
                    </div>
                    <Input name="city" required label="City *" placeholder="Ontario" />
                    <Input name="state" label="State" placeholder="CA" defaultValue="CA" maxLength={2} />
                    <Input name="zip_code" label="Zip Code" placeholder="91761" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                      <select
                        name="property_type"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      >
                        <option value="">Select type...</option>
                        <optgroup label="Industrial">
                          <option value="warehouse">Warehouse</option>
                          <option value="distribution_center">Distribution Center</option>
                          <option value="manufacturing">Manufacturing</option>
                          <option value="flex_space">Flex Space</option>
                          <option value="cold_storage">Cold Storage</option>
                          <option value="industrial">Industrial (General)</option>
                        </optgroup>
                        <optgroup label="Commercial">
                          <option value="retail">Retail</option>
                          <option value="office">Office</option>
                          <option value="mixed_use">Mixed Use</option>
                        </optgroup>
                        <optgroup label="Residential">
                          <option value="multifamily">Multifamily</option>
                          <option value="residential">Residential</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option value="land">Land</option>
                          <option value="other">Other</option>
                        </optgroup>
                      </select>
                    </div>
                    <Input name="building_size" type="number" label="Building Size (SF)" placeholder="50000" />
                    <Input name="lot_size" type="number" label="Lot Size (SF)" placeholder="80000" />
                    <Input name="year_built" type="number" label="Year Built" placeholder="2005" />
                    <Input name="price" type="number" label="Price" placeholder="5000000" />
                    <Input name="cap_rate" type="number" step="0.01" label="CAP Rate (%)" placeholder="5.5" />
                    <div className="col-span-2">
                      <Input name="apn" label="APN(s)" placeholder="0110-141-01, 0110-141-02" />
                      <p className="mt-1 text-xs text-gray-500">Separate multiple APNs with commas</p>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={() => setAddMode('choose')} className="flex-1">
                      Back
                    </Button>
                    <Button type="submit" isLoading={addSaving} disabled={addSaving} className="flex-1">
                      {addSaving ? 'Creating...' : 'Create Property'}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Layout>
  );
}
