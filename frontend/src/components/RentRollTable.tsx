import type { Tenant } from '../types';

interface RentRollTableProps {
  tenants: Tenant[];
  onEdit?: (tenant: Tenant) => void;
  onDelete?: (id: string) => void;
}

const LEASE_TYPE_LABELS: Record<string, string> = {
  gross: 'Gross',
  modified_gross: 'Modified Gross',
  nnn: 'NNN',
  nn: 'NN',
  percentage: 'Percentage',
  month_to_month: 'M-to-M',
  ground: 'Ground',
};

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('en-US').format(n);

export default function RentRollTable({ tenants, onEdit, onDelete }: RentRollTableProps) {
  const activeTenants = tenants.filter(t => t.is_active);
  const totalMonthlyRent = activeTenants.reduce((s, t) => s + (t.monthly_base_rent || 0), 0);
  const totalLeasedSf = activeTenants.reduce((s, t) => s + (t.leased_sf || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unit</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tenant</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lease Type</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">SF</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monthly Rent</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rent/SF</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lease End</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            {(onEdit || onDelete) && (
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenants.map(t => (
            <tr key={t.id} className={`hover:bg-gray-50 ${!t.is_active ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.unit_number || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{t.tenant_name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{t.lease_type ? LEASE_TYPE_LABELS[t.lease_type] || t.lease_type : '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">{t.leased_sf ? fmtNum(t.leased_sf) : '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">{t.monthly_base_rent ? fmt(t.monthly_base_rent) : '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">{t.rent_per_sf ? `$${t.rent_per_sf.toFixed(2)}` : '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{t.lease_end || '-'}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              {(onEdit || onDelete) && (
                <td className="px-4 py-3 text-right">
                  {onEdit && <button onClick={() => onEdit(t)} className="text-primary-600 hover:text-primary-800 text-sm mr-3">Edit</button>}
                  {onDelete && t.is_active && <button onClick={() => onDelete(t.id)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900" colSpan={3}>
              Totals ({activeTenants.length} active tenant{activeTenants.length !== 1 ? 's' : ''})
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmtNum(totalLeasedSf)}</td>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmt(totalMonthlyRent)}</td>
            <td colSpan={onEdit || onDelete ? 4 : 3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
