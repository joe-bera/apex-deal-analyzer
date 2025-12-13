import { HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  primary: 'bg-primary-100 text-primary-800',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge = ({
  variant = 'default',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) => {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};

// Property type badge with automatic coloring
export const PropertyTypeBadge = ({ type }: { type: string }) => {
  const typeColors: Record<string, BadgeVariant> = {
    warehouse: 'info',
    distribution_center: 'primary',
    manufacturing: 'warning',
    flex_space: 'success',
    cold_storage: 'info',
    industrial: 'default',
    office: 'success',
    retail: 'warning',
    land: 'default',
  };

  const displayName = type?.replace(/_/g, ' ') || 'Unknown';
  const variant = typeColors[type] || 'default';

  return (
    <Badge variant={variant} size="sm">
      {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
    </Badge>
  );
};
