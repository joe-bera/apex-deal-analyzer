import { useState } from 'react';

interface StreetViewImageProps {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

/**
 * Google Street View Static API Image Component
 *
 * Displays a street-level photo of a property based on its address.
 * Requires VITE_GOOGLE_MAPS_API_KEY environment variable to be set.
 *
 * Get your API key at: https://console.cloud.google.com/apis/credentials
 * Enable: "Street View Static API" and "Geocoding API"
 */
export default function StreetViewImage({
  address,
  city,
  state,
  zipCode,
  width = 400,
  height = 300,
  className = '',
  fallbackIcon,
}: StreetViewImageProps) {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Build full address string
  const fullAddress = [address, city, state, zipCode].filter(Boolean).join(', ');

  // If no API key, show placeholder
  if (!apiKey) {
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-4">
          {fallbackIcon || (
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 22V12h6v10" />
            </svg>
          )}
          <p className="text-xs text-gray-400">Street View not configured</p>
        </div>
      </div>
    );
  }

  // Build Street View Static API URL
  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodeURIComponent(fullAddress)}&key=${apiKey}&source=outdoor`;

  if (imageError) {
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center p-4">
          {fallbackIcon || (
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
          <p className="text-xs text-gray-400">No street view available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {loading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={streetViewUrl}
        alt={`Street view of ${fullAddress}`}
        className="w-full h-full object-cover rounded-lg"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setImageError(true);
        }}
      />
      {/* Google attribution */}
      <div className="absolute bottom-1 right-1 bg-white bg-opacity-75 px-1 py-0.5 rounded text-xs text-gray-500">
        Google Street View
      </div>
    </div>
  );
}
