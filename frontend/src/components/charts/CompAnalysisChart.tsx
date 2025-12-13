import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
  Line,
} from 'recharts';
import type { Property, Comp } from '../../types';

interface CompAnalysisChartProps {
  property: Property;
  comps: Comp[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

// Price Per SF Comparison
export function PricePerSfComparison({ property, comps }: CompAnalysisChartProps) {
  const subjectPriceSf = property.price_per_sqft ||
    (property.price && property.building_size ? property.price / property.building_size : 0);

  const data = [
    {
      name: 'Subject',
      priceSf: subjectPriceSf,
      isSubject: true,
    },
    ...comps.map((comp, i) => ({
      name: comp.comp_address?.substring(0, 12) || `Comp ${i + 1}`,
      priceSf: comp.comp_price_per_sqft ||
        (comp.comp_sale_price && comp.comp_square_footage
          ? comp.comp_sale_price / comp.comp_square_footage
          : 0),
      isSubject: false,
    })),
  ].filter(d => d.priceSf > 0);

  if (data.length < 2) return null;

  const avgCompPriceSf = comps
    .filter(c => c.comp_price_per_sqft || (c.comp_sale_price && c.comp_square_footage))
    .reduce((sum, c, _, arr) => {
      const priceSf = c.comp_price_per_sqft || (c.comp_sale_price / (c.comp_square_footage || 1));
      return sum + priceSf / arr.length;
    }, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Price/SF Comparison</h3>
        <span className="text-sm text-gray-500">Comp Avg: ${avgCompPriceSf.toFixed(0)}/SF</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(0)}/SF`, 'Price/SF']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <ReferenceLine y={avgCompPriceSf} stroke="#9CA3AF" strokeDasharray="5 5" />
          <Bar dataKey="priceSf" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isSubject ? '#B21F24' : '#1E40AF'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#B21F24] rounded"></span> Subject Property
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#1E40AF] rounded"></span> Comparables
        </span>
      </div>
    </div>
  );
}

// Sale Price Comparison with Size Context
export function SalePriceComparison({ property, comps }: CompAnalysisChartProps) {
  const data = [
    {
      name: 'Subject',
      price: property.price || 0,
      size: property.building_size || 0,
      isSubject: true,
    },
    ...comps.map((comp, i) => ({
      name: comp.comp_address?.substring(0, 12) || `Comp ${i + 1}`,
      price: comp.comp_sale_price || 0,
      size: comp.comp_square_footage || 0,
      isSubject: false,
    })),
  ].filter(d => d.price > 0);

  if (data.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Sale Price vs Building Size</h3>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'price' ? formatCurrency(value) : `${value.toLocaleString()} SF`,
              name === 'price' ? 'Sale Price' : 'Building Size',
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
          />
          <Bar yAxisId="left" dataKey="price" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isSubject ? '#B21F24' : '#1E40AF'}
              />
            ))}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="size" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#B21F24] rounded"></span> Subject
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#1E40AF] rounded"></span> Comps
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#059669] rounded-full"></span> Building Size
        </span>
      </div>
    </div>
  );
}

// Valuation Spread Analysis
export function ValuationSpreadChart({ property, comps }: CompAnalysisChartProps) {
  const subjectPrice = property.price || 0;

  const compPrices = comps
    .filter(c => c.comp_sale_price > 0)
    .map(c => c.comp_sale_price);

  if (compPrices.length === 0) return null;

  const minComp = Math.min(...compPrices);
  const maxComp = Math.max(...compPrices);
  const avgComp = compPrices.reduce((sum, p) => sum + p, 0) / compPrices.length;

  const spread = maxComp - minComp;
  const subjectPosition = subjectPrice > 0 ? ((subjectPrice - minComp) / spread) * 100 : 50;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Market Position</h3>
      <div className="relative h-16 mb-4">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full"></div>

        {/* Min marker */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-1 h-6 bg-green-600 rounded"></div>
          <span className="text-xs text-gray-500 mt-1">{formatCurrency(minComp)}</span>
        </div>

        {/* Max marker */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-1 h-6 bg-red-600 rounded"></div>
          <span className="text-xs text-gray-500 mt-1">{formatCurrency(maxComp)}</span>
        </div>

        {/* Average marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${((avgComp - minComp) / spread) * 100}%` }}
        >
          <div className="w-0.5 h-8 bg-gray-400"></div>
          <span className="text-xs text-gray-400 mt-1">Avg</span>
        </div>

        {/* Subject marker */}
        {subjectPrice > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10"
            style={{ left: `${Math.max(5, Math.min(95, subjectPosition))}%` }}
          >
            <div className="w-4 h-4 bg-[#B21F24] rounded-full border-2 border-white shadow-lg"></div>
            <span className="text-xs font-semibold text-[#B21F24] mt-1">{formatCurrency(subjectPrice)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500">Below Avg</p>
          <p className="text-lg font-semibold text-green-600">
            {subjectPrice < avgComp ? formatCurrency(avgComp - subjectPrice) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Comp Average</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(avgComp)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Above Avg</p>
          <p className="text-lg font-semibold text-red-600">
            {subjectPrice > avgComp ? formatCurrency(subjectPrice - avgComp) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Comp Quality Indicator
export function CompQualityIndicator({ property, comps }: CompAnalysisChartProps) {
  const scores: { label: string; score: number; max: number }[] = [];

  // Score based on number of comps
  const compCountScore = Math.min(comps.length * 20, 100);
  scores.push({ label: 'Comp Count', score: compCountScore, max: 100 });

  // Score based on similarity (same property type)
  const sameTypeCount = comps.filter(c => c.comp_property_type === property.property_type).length;
  const typeScore = comps.length > 0 ? (sameTypeCount / comps.length) * 100 : 0;
  scores.push({ label: 'Type Match', score: typeScore, max: 100 });

  // Score based on size similarity (within 25%)
  const sizeMatchCount = comps.filter(c => {
    if (!c.comp_square_footage || !property.building_size) return false;
    const ratio = c.comp_square_footage / property.building_size;
    return ratio >= 0.75 && ratio <= 1.25;
  }).length;
  const sizeScore = comps.length > 0 ? (sizeMatchCount / comps.length) * 100 : 0;
  scores.push({ label: 'Size Match', score: sizeScore, max: 100 });

  // Score based on recency (within 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentCount = comps.filter(c => new Date(c.comp_sale_date) >= oneYearAgo).length;
  const recencyScore = comps.length > 0 ? (recentCount / comps.length) * 100 : 0;
  scores.push({ label: 'Recency', score: recencyScore, max: 100 });

  const overallScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getOverallLabel = (score: number) => {
    if (score >= 70) return { label: 'High Confidence', color: 'text-green-600' };
    if (score >= 40) return { label: 'Medium Confidence', color: 'text-yellow-600' };
    return { label: 'Low Confidence', color: 'text-red-600' };
  };

  const overall = getOverallLabel(overallScore);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Comp Quality Score</h3>
        <span className={`text-sm font-semibold ${overall.color}`}>{overall.label}</span>
      </div>

      <div className="flex items-center justify-center mb-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${getScoreColor(overallScore)}`}>
          <span className="text-2xl font-bold">{Math.round(overallScore)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {scores.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">{item.label}</span>
              <span className="font-medium">{Math.round(item.score)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.score >= 70 ? 'bg-green-500' : item.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompAnalysisCharts({ property, comps }: CompAnalysisChartProps) {
  if (comps.length === 0) return null;

  return (
    <div className="space-y-4">
      <ValuationSpreadChart property={property} comps={comps} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PricePerSfComparison property={property} comps={comps} />
        <CompQualityIndicator property={property} comps={comps} />
      </div>
      <SalePriceComparison property={property} comps={comps} />
    </div>
  );
}
