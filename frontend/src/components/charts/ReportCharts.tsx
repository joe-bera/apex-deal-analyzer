import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type {
  PipelineForecastData,
  BrokerProductionData,
  RevenueReportData,
  ActivitySummaryData,
  PropertyAnalyticsData,
  ProspectingReportData,
} from '../../types';

const COLORS = ['#B21F24', '#1E40AF', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#4F46E5', '#DC2626'];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const formatLabel = (str: string) =>
  str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ============================================================================
// Pipeline Forecast Charts
// ============================================================================
export function PipelineForecastCharts({ data }: { data: PipelineForecastData }) {
  if (!data?.deals_by_stage) return <p className="text-gray-500 text-sm p-8 text-center">No pipeline data available</p>;
  const stageData = data.deals_by_stage.filter(s => s.count > 0 || s.total_value > 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Deals" value={String(data.active_deals)} />
        <StatCard label="Total Pipeline" value={formatCurrency(data.total_pipeline)} />
        <StatCard label="Weighted Forecast" value={formatCurrency(data.weighted_forecast_total)} />
        <StatCard label="Stages with Deals" value={String(stageData.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals by Stage */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Pipeline by Stage</h3>
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="stage" tick={{ fontSize: 10 }} tickFormatter={formatLabel} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'total_value' ? 'Total Value' : 'Weighted Value']}
                  labelFormatter={formatLabel}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="total_value" name="Total Value" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weighted_value" name="Weighted Value" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No active deals in pipeline</p>
          )}
        </div>

        {/* Monthly Projections */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Projections</h3>
          {(data.monthly_projections || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthly_projections} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'deal_count' ? value : formatCurrency(value),
                    name === 'weighted_value' ? 'Weighted' : name === 'total_value' ? 'Total' : 'Deals',
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="weighted_value" name="Weighted" fill="#B21F24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No projected close dates set</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Broker Production Charts
// ============================================================================
export function BrokerProductionCharts({ data }: { data: BrokerProductionData }) {
  if (!data?.totals || !data?.brokers) return <p className="text-gray-500 text-sm p-8 text-center">No broker production data available</p>;
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Deals Closed" value={String(data.totals.deals_closed)} />
        <StatCard label="Total Deal Value" value={formatCurrency(data.totals.total_deal_value)} />
        <StatCard label="Total Commission" value={formatCurrency(data.totals.total_commission)} />
      </div>

      {/* Broker Commission Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Commission by Broker</h3>
        {data.brokers.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, data.brokers.length * 50)}>
            <BarChart data={data.brokers} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
              <YAxis dataKey="broker_name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'total_commission' ? 'Commission' : 'Deal Value',
                ]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Bar dataKey="total_commission" name="Commission" fill="#059669" radius={[0, 4, 4, 0]}>
                {data.brokers.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No closed deals in this period</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Revenue Charts
// ============================================================================
export function RevenueCharts({ data }: { data: RevenueReportData }) {
  if (!data?.totals || !data?.monthly) return <p className="text-gray-500 text-sm p-8 text-center">No revenue data available</p>;
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Commission" value={formatCurrency(data.totals.commission)} />
        <StatCard label="Total Deal Value" value={formatCurrency(data.totals.deal_value)} />
        <StatCard label="Deals Closed" value={String(data.totals.deal_count)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Commission Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Commission</h3>
          {data.monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Commission']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="commission" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No revenue data in this period</p>
          )}
        </div>

        {/* Deal Type Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue by Deal Type</h3>
          {data.type_breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.type_breakdown.map(t => ({ name: formatLabel(t.deal_type), value: t.commission }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.type_breakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Commission']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No revenue data</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Activity Summary Charts
// ============================================================================
export function ActivitySummaryCharts({ data }: { data: ActivitySummaryData }) {
  if (!data?.task_completion || !data?.by_type) return <p className="text-gray-500 text-sm p-8 text-center">No activity data available</p>;
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Activities" value={String(data.total_activities)} />
        <StatCard label="Tasks Created" value={String(data.task_completion.total)} />
        <StatCard label="Tasks Completed" value={String(data.task_completion.completed)} />
        <StatCard label="Completion Rate" value={`${data.task_completion.rate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Activities by Type</h3>
          {data.by_type.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.by_type} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} tickFormatter={formatLabel} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name === 'count' ? 'Total' : 'Completed']}
                  labelFormatter={formatLabel}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="count" name="Total" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No activities recorded</p>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Activity Trend</h3>
          {data.by_period.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.by_period} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'Activities']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="count" fill="#B21F24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No activity data</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Property Analytics Charts
// ============================================================================
export function PropertyAnalyticsCharts({ data }: { data: PropertyAnalyticsData }) {
  if (!data?.summary || !data?.by_type) return <p className="text-gray-500 text-sm p-8 text-center">No property analytics data available</p>;
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Properties" value={String(data.summary.total_properties)} />
        <StatCard label="Total Value" value={formatCurrency(data.summary.total_value)} />
        <StatCard label="Avg Price/SF" value={`$${data.summary.avg_price_sf}`} />
        <StatCard label="Avg CAP Rate" value={`${data.summary.avg_cap_rate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type - Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Properties by Type</h3>
          {data.by_type.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.by_type.map(t => ({ name: formatLabel(t.type), value: t.count }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.by_type.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, 'Properties']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No property data</p>
          )}
        </div>

        {/* By Submarket - Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Properties by Submarket</h3>
          {data.by_submarket.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.by_submarket.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="submarket" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'avg_price_sf' ? `$${value}/SF` : value,
                    name === 'avg_price_sf' ? 'Avg Price/SF' : 'Properties',
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No submarket data</p>
          )}
        </div>

        {/* Price/SF Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Price/SF Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.price_sf_distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, 'Properties']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Bar dataKey="count" fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CAP Rate Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">CAP Rate Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.cap_rate_distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, 'Properties']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Prospecting Report Charts
// ============================================================================
export function ProspectingReportCharts({ data }: { data: ProspectingReportData }) {
  if (!data?.conversion_rates || !data?.status_distribution) return <p className="text-gray-500 text-sm p-8 text-center">No prospecting data available</p>;
  const statusColors: Record<string, string> = {
    pending: '#94A3B8',
    contacted: '#3B82F6',
    qualified: '#10B981',
    not_interested: '#EF4444',
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Lists" value={String(data.total_lists)} />
        <StatCard label="Total Prospects" value={String(data.total_items)} />
        <StatCard label="Contact Rate" value={`${data.conversion_rates.contact_rate}%`} />
        <StatCard label="Qualification Rate" value={`${data.conversion_rates.qualification_rate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution - Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Status Distribution</h3>
          {data.status_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.status_distribution.map(s => ({ name: formatLabel(s.status), value: s.count }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.status_distribution.map((s, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[s.status] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, 'Prospects']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No prospect data</p>
          )}
        </div>

        {/* Per List Breakdown - Stacked Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Breakdown by List</h3>
          {data.per_list_breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.per_list_breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="list_name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#94A3B8" />
                <Bar dataKey="contacted" name="Contacted" stackId="a" fill="#3B82F6" />
                <Bar dataKey="qualified" name="Qualified" stackId="a" fill="#10B981" />
                <Bar dataKey="not_interested" name="Not Interested" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No lists to display</p>
          )}
        </div>
      </div>
    </div>
  );
}
