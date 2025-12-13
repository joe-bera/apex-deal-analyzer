import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <div className="text-center py-16 px-6">
      {icon ? (
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          {icon}
        </div>
      ) : (
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 max-w-md mx-auto">{description}</p>
      {action && (
        <div className="mt-6">
          <Button onClick={action.onClick} size="lg">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};

// Loading skeleton for property cards
export const PropertyCardSkeleton = () => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-7 bg-gray-200 rounded w-1/3 mt-4" />
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 rounded w-12" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 rounded w-12" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 rounded w-12" />
            <div className="h-4 bg-gray-200 rounded w-14" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading skeleton for stats
export const StatsSkeleton = () => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
      <div className="h-8 bg-gray-200 rounded w-32" />
    </div>
  );
};
