import { ReactNode } from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'highlight';
}

export const StatsCard = ({
  label,
  value,
  subValue,
  icon,
  trend,
  variant = 'default',
}: StatsCardProps) => {
  const isHighlight = variant === 'highlight';

  return (
    <div
      className={`
        rounded-xl p-5
        ${isHighlight
          ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white'
          : 'bg-white border border-gray-200'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${isHighlight ? 'text-primary-100' : 'text-gray-500'}`}>
            {label}
          </p>
          <p className={`text-2xl font-bold mt-1 ${isHighlight ? 'text-white' : 'text-gray-900'}`}>
            {value}
          </p>
          {subValue && (
            <p className={`text-sm mt-0.5 ${isHighlight ? 'text-primary-200' : 'text-gray-500'}`}>
              {subValue}
            </p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend.isPositive
                ? isHighlight ? 'text-green-200' : 'text-green-600'
                : isHighlight ? 'text-red-200' : 'text-red-600'
            }`}>
              {trend.isPositive ? (
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${isHighlight ? 'bg-primary-500/30' : 'bg-gray-100'}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// Metric display for property details
interface MetricProps {
  label: string;
  value: string | number | undefined | null;
  format?: 'currency' | 'number' | 'percent' | 'text';
  size?: 'sm' | 'md' | 'lg';
}

export const Metric = ({ label, value, format = 'text', size = 'md' }: MetricProps) => {
  const formatValue = () => {
    if (value === null || value === undefined) return '—';

    switch (format) {
      case 'currency':
        return typeof value === 'number'
          ? `$${value.toLocaleString()}`
          : value;
      case 'number':
        return typeof value === 'number'
          ? value.toLocaleString()
          : value;
      case 'percent':
        return `${value}%`;
      default:
        return value;
    }
  };

  const sizeStyles = {
    sm: { label: 'text-xs', value: 'text-sm' },
    md: { label: 'text-sm', value: 'text-base' },
    lg: { label: 'text-sm', value: 'text-xl' },
  };

  return (
    <div>
      <dt className={`${sizeStyles[size].label} text-gray-500 font-medium`}>{label}</dt>
      <dd className={`${sizeStyles[size].value} text-gray-900 font-semibold mt-0.5`}>
        {formatValue()}
      </dd>
    </div>
  );
};
