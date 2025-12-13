import { Link } from 'react-router-dom';
import { Card } from './Card';
import { Badge, PropertyTypeBadge } from './Badge';
import type { Property } from '../../types';

interface PropertyCardProps {
  property: Property;
}

export const PropertyCard = ({ property }: PropertyCardProps) => {
  const formatCurrency = (value: number | null | undefined) =>
    value ? `$${value.toLocaleString()}` : '—';

  const formatNumber = (value: number | null | undefined) =>
    value ? value.toLocaleString() : '—';

  return (
    <Link to={`/properties/${property.id}`}>
      <Card hover padding="none" className="h-full">
        {/* Property Image Placeholder */}
        <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          {/* Property Type Badge */}
          <div className="absolute top-3 left-3">
            {property.property_type && (
              <PropertyTypeBadge type={property.property_type} />
            )}
          </div>
          {/* CAP Rate Badge */}
          {property.cap_rate && (
            <div className="absolute top-3 right-3">
              <Badge variant="success" size="md">
                {property.cap_rate}% CAP
              </Badge>
            </div>
          )}
        </div>

        {/* Property Details */}
        <div className="p-4">
          {/* Address */}
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
            {property.address || 'Address Not Available'}
          </h3>
          <p className="text-gray-500 text-sm mt-0.5">
            {[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}
          </p>

          {/* Price */}
          <div className="mt-4">
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(property.price)}
            </span>
            {property.price_per_sqft && (
              <span className="text-gray-500 text-sm ml-2">
                ${property.price_per_sqft}/SF
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
        </div>
      </Card>
    </Link>
  );
};

// Compact property card for lists
export const PropertyCardCompact = ({ property }: PropertyCardProps) => {
  const formatCurrency = (value: number | null | undefined) =>
    value ? `$${value.toLocaleString()}` : '—';

  return (
    <Link to={`/properties/${property.id}`}>
      <div className="flex items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>

        {/* Details */}
        <div className="ml-4 flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {property.address || 'Address Not Available'}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {[property.city, property.state].filter(Boolean).join(', ')}
          </p>
        </div>

        {/* Price & Type */}
        <div className="ml-4 text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">{formatCurrency(property.price)}</p>
          {property.property_type && (
            <PropertyTypeBadge type={property.property_type} />
          )}
        </div>

        {/* Arrow */}
        <div className="ml-4 flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
};
