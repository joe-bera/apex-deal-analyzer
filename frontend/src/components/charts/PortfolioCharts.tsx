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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import type { Property } from '../../types';

interface PortfolioChartsProps {
  properties: Property[];
}

const COLORS = ['#B21F24', '#1E40AF', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2'];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const formatNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};

// Property Type Distribution Pie Chart
export function PropertyTypeChart({ properties }: PortfolioChartsProps) {
  const typeData = properties.reduce((acc, prop) => {
    const type = prop.property_type || 'other';
    const label = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const existing = acc.find(d => d.name === label);
    if (existing) {
      existing.value += 1;
      existing.totalValue += prop.price || 0;
    } else {
      acc.push({ name: label, value: 1, totalValue: prop.price || 0 });
    }
    return acc;
  }, [] as { name: string; value: number; totalValue: number }[]);

  if (typeData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Property Type Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={typeData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {typeData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string, props: any) => [
              `${value} properties (${formatCurrency(props.payload.totalValue)})`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Price Distribution Bar Chart
export function PriceDistributionChart({ properties }: PortfolioChartsProps) {
  const priceRanges = [
    { range: '<$500K', min: 0, max: 500000 },
    { range: '$500K-$1M', min: 500000, max: 1000000 },
    { range: '$1M-$2M', min: 1000000, max: 2000000 },
    { range: '$2M-$5M', min: 2000000, max: 5000000 },
    { range: '$5M-$10M', min: 5000000, max: 10000000 },
    { range: '>$10M', min: 10000000, max: Infinity },
  ];

  const data = priceRanges.map(({ range, min, max }) => ({
    range,
    count: properties.filter(p => (p.price || 0) >= min && (p.price || 0) < max).length,
  })).filter(d => d.count > 0 || priceRanges.indexOf(priceRanges.find(r => r.range === d.range)!) < 4);

  if (data.every(d => d.count === 0)) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Price Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="range" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [`${value} properties`, 'Count']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Bar dataKey="count" fill="#B21F24" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// CAP Rate Distribution Chart
export function CapRateChart({ properties }: PortfolioChartsProps) {
  const propertiesWithCap = properties.filter(p => p.cap_rate && p.cap_rate > 0);

  if (propertiesWithCap.length === 0) return null;

  const data = propertiesWithCap
    .map(p => ({
      name: p.address?.substring(0, 15) || p.city || 'Property',
      capRate: p.cap_rate || 0,
      price: p.price || 0,
    }))
    .sort((a, b) => b.capRate - a.capRate)
    .slice(0, 10);

  const avgCapRate = propertiesWithCap.reduce((sum, p) => sum + (p.cap_rate || 0), 0) / propertiesWithCap.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">CAP Rate Comparison</h3>
        <span className="text-sm text-gray-500">Avg: {avgCapRate.toFixed(1)}%</span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" domain={[0, 'dataMax + 1']} tick={{ fontSize: 11 }} unit="%" />
          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'CAP Rate']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Bar dataKey="capRate" fill="#059669" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.capRate >= avgCapRate ? '#059669' : '#D97706'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2 text-center">
        <span className="inline-block w-3 h-3 bg-green-600 rounded mr-1"></span> Above avg
        <span className="inline-block w-3 h-3 bg-yellow-600 rounded ml-3 mr-1"></span> Below avg
      </p>
    </div>
  );
}

// Price per SF by Market
export function MarketComparisonChart({ properties }: PortfolioChartsProps) {
  const marketData = properties.reduce((acc, prop) => {
    const market = prop.market || prop.city || 'Unknown';
    const existing = acc.find(d => d.market === market);
    const priceSf = prop.price_per_sqft || (prop.price && prop.building_size ? prop.price / prop.building_size : 0);

    if (existing) {
      existing.properties += 1;
      existing.totalPriceSf += priceSf;
      existing.avgPriceSf = existing.totalPriceSf / existing.properties;
    } else {
      acc.push({
        market,
        properties: 1,
        totalPriceSf: priceSf,
        avgPriceSf: priceSf,
      });
    }
    return acc;
  }, [] as { market: string; properties: number; totalPriceSf: number; avgPriceSf: number }[]);

  const data = marketData
    .filter(d => d.avgPriceSf > 0)
    .sort((a, b) => b.avgPriceSf - a.avgPriceSf)
    .slice(0, 8);

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Avg Price/SF by Market</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="market" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'avgPriceSf' ? `$${value.toFixed(0)}/SF` : value,
              name === 'avgPriceSf' ? 'Avg Price/SF' : 'Properties',
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Bar dataKey="avgPriceSf" fill="#1E40AF" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Size vs Price Scatter Plot
export function SizePriceScatter({ properties }: PortfolioChartsProps) {
  const data = properties
    .filter(p => p.building_size && p.price)
    .map(p => ({
      name: p.address?.substring(0, 20) || p.city || 'Property',
      size: p.building_size || 0,
      price: p.price || 0,
      capRate: p.cap_rate || 0,
      type: p.property_type || 'other',
    }));

  if (data.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Size vs Price Analysis</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            type="number"
            dataKey="size"
            name="Size"
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fontSize: 11 }}
            label={{ value: 'Building Size (SF)', position: 'bottom', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="price"
            name="Price"
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11 }}
          />
          <ZAxis type="number" dataKey="capRate" range={[50, 400]} name="CAP Rate" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value: number, name: string) => {
              if (name === 'Size') return [formatNumber(value) + ' SF', name];
              if (name === 'Price') return [formatCurrency(value), name];
              if (name === 'CAP Rate') return [value.toFixed(2) + '%', name];
              return [value, name];
            }}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Scatter name="Properties" data={data} fill="#B21F24">
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Bubble size indicates CAP rate
      </p>
    </div>
  );
}

// Portfolio Summary Stats
export function PortfolioSummary({ properties }: PortfolioChartsProps) {
  const totalValue = properties.reduce((sum, p) => sum + (p.price || 0), 0);
  const avgCapRate = properties.filter(p => p.cap_rate).reduce((sum, p, _, arr) => sum + (p.cap_rate || 0) / arr.length, 0);
  const totalSqft = properties.reduce((sum, p) => sum + (p.building_size || 0), 0);
  const avgPriceSf = totalSqft > 0 ? totalValue / totalSqft : 0;

  const highestCap = properties.reduce((max, p) => (p.cap_rate || 0) > (max?.cap_rate || 0) ? p : max, properties[0]);
  const lowestPriceSf = properties.filter(p => p.price_per_sqft).reduce((min, p) =>
    (p.price_per_sqft || Infinity) < (min?.price_per_sqft || Infinity) ? p : min, properties[0]);

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        Portfolio Highlights
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-xs">Total Portfolio Value</p>
          <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Avg Price/SF</p>
          <p className="text-2xl font-bold">${avgPriceSf.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Avg CAP Rate</p>
          <p className="text-2xl font-bold text-green-400">{avgCapRate.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Total Square Feet</p>
          <p className="text-2xl font-bold">{formatNumber(totalSqft)}</p>
        </div>
      </div>

      {(highestCap || lowestPriceSf) && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-gray-400 text-xs mb-2">Best Opportunities</p>
          <div className="space-y-2">
            {highestCap && highestCap.cap_rate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 truncate">{highestCap.address || highestCap.city}</span>
                <span className="text-green-400 font-medium">Highest CAP: {highestCap.cap_rate}%</span>
              </div>
            )}
            {lowestPriceSf && lowestPriceSf.price_per_sqft && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 truncate">{lowestPriceSf.address || lowestPriceSf.city}</span>
                <span className="text-blue-400 font-medium">Best Value: ${lowestPriceSf.price_per_sqft}/SF</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export all charts as a combined component
export default function PortfolioCharts({ properties }: PortfolioChartsProps) {
  if (properties.length === 0) return null;

  return (
    <div className="space-y-6">
      <PortfolioSummary properties={properties} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PropertyTypeChart properties={properties} />
        <CapRateChart properties={properties} />
        <PriceDistributionChart properties={properties} />
        <MarketComparisonChart properties={properties} />
      </div>
      <SizePriceScatter properties={properties} />
    </div>
  );
}
