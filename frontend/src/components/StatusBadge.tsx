interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  prospect: {
    label: 'Prospect',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  contacted: {
    label: 'Contacted',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  pitched: {
    label: 'Pitched',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
  listed: {
    label: 'Listed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  under_contract: {
    label: 'Under Contract',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
  },
  sold: {
    label: 'Sold',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
  dead: {
    label: 'Dead',
    color: 'text-gray-700',
    bgColor: 'bg-gray-200',
  },
  watch: {
    label: 'Watching',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.color} ${SIZE_CLASSES[size]}`}
    >
      {config.label}
    </span>
  );
}

// Export status options for select dropdowns
export const STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'pitched', label: 'Pitched' },
  { value: 'listed', label: 'Listed' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
  { value: 'watch', label: 'Watching' },
];
