import { Link } from 'react-router-dom';
import { Card } from './Card';
import { Badge, PropertyTypeBadge } from './Badge';
import type { Property } from '../../types';

interface PropertyCardProps {
  property: Property;
}

// Helper to determine deal quality indicator
const getDealIndicator = (property: Property): { label: string; color: string; icon: string } | null => {
  if (!property.cap_rate) return null;

  if (property.cap_rate >= 7) {
    return { label: 'Hot Deal', color: 'bg-red-500', icon: '🔥' };
  } else if (property.cap_rate >= 5.5) {
    return { label: 'Good CAP', color: 'bg-green-500', icon: '✓' };
  }
  return null;
};

// Helper to get price comparison indicator
const getPriceIndicator = (property: Property): { label: string; color: string } | null => {
  if (!property.price_per_sqft) return null;

  // These thresholds are example values for industrial properties
  if (property.price_per_sqft < 150) {
    return { label: 'Below Market', color: 'text-green-600' };
  } else if (property.price_per_sqft > 300) {
    return { label: 'Premium', color: 'text-orange-600' };
  }
  return null;
};

export const PropertyCard = ({ property }: PropertyCardProps) => {
  const formatCurrency = (value: number | null | undefined) =>
    value ? `$${value.toLocaleString()}` : '—';

  const formatNumber = (value: number | null | undefined) =>
    value ? value.toLocaleString() : '—';

  const dealIndicator = getDealIndicator(property);
  const priceIndicator = getPriceIndicator(property);

  // Check if property has comps (we'll use cap_rate as a proxy since it's usually set after analysis)
  const hasAnalysis = Boolean(property.cap_rate);

  return (
    <Link to={`/properties/${property.id}`}>
      <Card hover padding="none" className="h-full overflow-hidden group">
        {/* Property Image */}
        <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
          {property.primary_photo_url ? (
            <img
              src={property.primary_photo_url}
              alt={property.address || 'Property'}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-50">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id={`grid-${property.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#grid-${property.id})`} />
                </svg>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </>
          )}

          {/* Top Left Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {property.property_type && (
              <PropertyTypeBadge type={property.property_type} />
            )}
            {dealIndicator && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white ${dealIndicator.color} shadow-lg`}>
                <span>{dealIndicator.icon}</span>
                {dealIndicator.label}
              </span>
            )}
          </div>

          {/* Top Right Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
            {property.cap_rate && (
              <Badge variant="success" size="md">
                {property.cap_rate}% CAP
              </Badge>
            )}
            {hasAnalysis && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500 text-white shadow">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Analyzed
              </span>
            )}
          </div>

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-primary-600 opacity-0 group-hover:opacity-10 transition-opacity duration-200" />
        </div>

        {/* Property Details */}
        <div className="p-4">
          {/* Address */}
          <h3 className="font-semibold text-gray-900 text-lg leading-tight group-hover:text-primary-600 transition-colors">
            {property.address || 'Address Not Available'}
          </h3>
          <p className="text-gray-500 text-sm mt-0.5">
            {[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}
          </p>

          {/* Price */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(property.price)}
            </span>
            {property.price_per_sqft && (
              <span className="text-gray-500 text-sm">
                ${property.price_per_sqft}/SF
              </span>
            )}
            {priceIndicator && (
              <span className={`text-xs font-medium ${priceIndicator.color}`}>
                {priceIndicator.label}
              </span>
            )}
          </div>

          {/* Key Metrics */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Size</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {formatNumber(property.building_size)} SF
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Year</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {property.year_built || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">NOI</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {property.noi ? `$${(property.noi / 1000).toFixed(0)}K` : '—'}
              </p>
            </div>
          </div>

          {/* Market */}
          {property.market && (
            <div className="mt-3 flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {property.market}
              {property.submarket && ` • ${property.submarket}`}
            </div>
          )}

          {/* Action Hint */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-sm text-primary-600 font-medium">View Details</span>
            <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Card>
    </Link>
  );
};

// Compact property card for lists
export const PropertyCardCompact = ({ property }: PropertyCardProps) => {
  const formatCurrency = (value: number | null | undefined) =>
    value ? `$${value.toLocaleString()}` : '—';

  const dealIndicator = getDealIndicator(property);
  const hasAnalysis = Boolean(property.cap_rate);

  return (
    <Link to={`/properties/${property.id}`}>
      <div className="flex items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all duration-150 group">
        {/* Icon with status indicator */}
        <div className="flex-shrink-0 relative">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center group-hover:from-primary-50 group-hover:to-primary-100 transition-colors">
            <svg className="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          {/* Analysis Status Dot */}
          {hasAnalysis && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
          )}
        </div>

        {/* Details */}
        <div className="ml-4 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
              {property.address || 'Address Not Available'}
            </p>
            {dealIndicator && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold text-white ${dealIndicator.color}`}>
                <span className="text-[10px]">{dealIndicator.icon}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">
            {[property.city, property.state].filter(Boolean).join(', ')}
            {property.cap_rate && ` • ${property.cap_rate}% CAP`}
          </p>
        </div>

        {/* Metrics */}
        <div className="hidden md:flex items-center gap-6 mx-4">
          {property.building_size && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Size</p>
              <p className="text-sm font-medium text-gray-700">{(property.building_size / 1000).toFixed(0)}K SF</p>
            </div>
          )}
          {property.price_per_sqft && (
            <div className="text-center">
              <p className="text-xs text-gray-400">$/SF</p>
              <p className="text-sm font-medium text-gray-700">${property.price_per_sqft}</p>
            </div>
          )}
        </div>

        {/* Price & Type */}
        <div className="ml-4 text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">{formatCurrency(property.price)}</p>
          <div className="mt-1">
            {property.property_type && (
              <PropertyTypeBadge type={property.property_type} />
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="ml-4 flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
};
