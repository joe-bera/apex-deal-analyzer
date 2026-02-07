import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import {
  PipelineForecastCharts,
  BrokerProductionCharts,
  RevenueCharts,
  ActivitySummaryCharts,
  PropertyAnalyticsCharts,
  ProspectingReportCharts,
} from '../components/charts/ReportCharts';
import { api } from '../lib/api';
import type { ReportType } from '../types';

const TABS: { key: ReportType; label: string; hasDateRange: boolean }[] = [
  { key: 'pipeline-forecast', label: 'Pipeline Forecast', hasDateRange: false },
  { key: 'broker-production', label: 'Broker Production', hasDateRange: true },
  { key: 'revenue', label: 'Revenue', hasDateRange: true },
  { key: 'activity-summary', label: 'Activity Summary', hasDateRange: true },
  { key: 'property-analytics', label: 'Property Analytics', hasDateRange: false },
  { key: 'prospecting', label: 'Prospecting', hasDateRange: false },
];

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportType>('pipeline-forecast');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const currentTabConfig = TABS.find(t => t.key === activeTab)!;

  const fetchReport = useCallback(async (tab: ReportType, start?: string, end?: string) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const dateParams = { start, end };
      let result: any;
      switch (tab) {
        case 'pipeline-forecast':
          result = await api.getReportPipelineForecast();
          break;
        case 'broker-production':
          result = await api.getReportBrokerProduction(dateParams);
          break;
        case 'revenue':
          result = await api.getReportRevenue(dateParams);
          break;
        case 'activity-summary':
          result = await api.getReportActivitySummary(dateParams);
          break;
        case 'property-analytics':
          result = await api.getReportPropertyAnalytics();
          break;
        case 'prospecting':
          result = await api.getReportProspecting();
          break;
      }
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tabConfig = TABS.find(t => t.key === activeTab)!;
    if (tabConfig.hasDateRange) {
      fetchReport(activeTab, startDate, endDate);
    } else {
      fetchReport(activeTab);
    }
  }, [activeTab, fetchReport]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyDates = () => {
    fetchReport(activeTab, startDate, endDate);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = currentTabConfig.hasDateRange ? { start: startDate, end: endDate } : undefined;
      await api.exportReportCSV(activeTab, params);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-500 mt-1">Analytics and insights across your deal pipeline</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Date Range Filter */}
        {currentTabConfig.hasDateRange && (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              onClick={handleApplyDates}
              className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              Apply
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">Loading report...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={() => fetchReport(activeTab, startDate, endDate)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {activeTab === 'pipeline-forecast' && <PipelineForecastCharts data={data} />}
            {activeTab === 'broker-production' && <BrokerProductionCharts data={data} />}
            {activeTab === 'revenue' && <RevenueCharts data={data} />}
            {activeTab === 'activity-summary' && <ActivitySummaryCharts data={data} />}
            {activeTab === 'property-analytics' && <PropertyAnalyticsCharts data={data} />}
            {activeTab === 'prospecting' && <ProspectingReportCharts data={data} />}
          </>
        ) : null}
      </div>
    </Layout>
  );
}
