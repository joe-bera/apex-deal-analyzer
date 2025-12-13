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
  PropertyCard,
  PropertyCardCompact,
  EmptyState,
  PropertyCardSkeleton,
  StatsSkeleton,
} from '../components/ui';
import { PortfolioCharts } from '../components/charts';

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

  // Calculate portfolio stats
  const stats = useMemo(() => {
    if (properties.length === 0) {
      return {
        totalProperties: 0,
        totalValue: 0,
        avgCapRate: 0,
        totalSqft: 0,
      };
    }

    const totalValue = properties.reduce((sum, p) => sum + (p.price || 0), 0);
    const capRates = properties.filter((p) => p.cap_rate).map((p) => p.cap_rate!);
    const avgCapRate = capRates.length > 0
      ? capRates.reduce((sum, rate) => sum + rate, 0) / capRates.length
      : 0;
    const totalSqft = properties.reduce((sum, p) => sum + (p.building_size || 0), 0);

    return {
      totalProperties: properties.length,
      totalValue,
      avgCapRate,
      totalSqft,
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
            <h1 className="text-2xl font-bold text-gray-900">Property Portfolio</h1>
            <p className="text-gray-500 mt-1">
              Manage and analyze your commercial real estate deals
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate('/upload')}
            leftIcon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Property
          </Button>
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
    </Layout>
  );
}
