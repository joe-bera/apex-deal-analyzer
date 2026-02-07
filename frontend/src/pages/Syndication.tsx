import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { Card, CardContent, Button, Badge, EmptyState } from '../components/ui';
import {
  SyndicationPlatform,
  SyndicationListing,
  ListingSite,
} from '../types';

type StatusColor = 'default' | 'info' | 'success' | 'warning' | 'error';

const STATUS_BADGE: Record<string, { label: string; variant: StatusColor }> = {
  draft: { label: 'Draft', variant: 'default' },
  pending: { label: 'Pending', variant: 'info' },
  published: { label: 'Published', variant: 'success' },
  synced: { label: 'Synced', variant: 'success' },
  error: { label: 'Error', variant: 'error' },
  delisted: { label: 'Delisted', variant: 'warning' },
};

const INTEGRATION_BADGE: Record<string, string> = {
  api: 'API',
  csv_export: 'CSV Export',
  manual: 'Manual',
};

export default function Syndication() {
  const [platforms, setPlatforms] = useState<SyndicationPlatform[]>([]);
  const [syndications, setSyndications] = useState<SyndicationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [listingSites, setListingSites] = useState<ListingSite[]>([]);
  const [selectedListingSiteId, setSelectedListingSiteId] = useState('');
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Export modal state
  const [showExport, setShowExport] = useState<string | null>(null);
  const [exportData, setExportData] = useState<{ data: string; file_name: string; platform_name: string } | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  // Pre-fill from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledListing = urlParams.get('listing');

  const loadData = useCallback(async () => {
    try {
      const [platformsRes, syndicationsRes] = await Promise.all([
        api.listSyndicationPlatforms(),
        api.listSyndications(),
      ]);
      if (platformsRes.success) setPlatforms(platformsRes.platforms);
      if (syndicationsRes.success) setSyndications(syndicationsRes.syndications);
    } catch {
      setError('Failed to load syndication data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When create modal opens, load listing sites
  useEffect(() => {
    if (!showCreate) return;
    (async () => {
      try {
        const res = await api.listListingSites();
        if (res.success) {
          setListingSites(res.listing_sites);
          if (prefilledListing) setSelectedListingSiteId(prefilledListing);
        }
      } catch { /* ignore */ }
    })();
  }, [showCreate, prefilledListing]);

  const handleCreate = async () => {
    if (!selectedListingSiteId || selectedPlatformIds.length === 0) return;
    setCreating(true);
    try {
      if (selectedPlatformIds.length === 1) {
        const res = await api.createSyndication({
          listing_site_id: selectedListingSiteId,
          platform_id: selectedPlatformIds[0],
        });
        if (res.success) {
          setSyndications(prev => [res.syndication, ...prev]);
        }
      } else {
        const res = await api.bulkPublishSyndication({
          listing_site_id: selectedListingSiteId,
          platform_ids: selectedPlatformIds,
        });
        if (res.success) {
          setSyndications(prev => [...res.syndications, ...prev]);
        }
      }
      setShowCreate(false);
      setSelectedListingSiteId('');
      setSelectedPlatformIds([]);
    } catch {
      setError('Failed to create syndication');
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await api.publishSyndication(id);
      if (res.success) {
        setSyndications(prev => prev.map(s => s.id === id ? { ...s, ...res.syndication } : s));
      }
    } catch { /* ignore */ }
  };

  const handleSync = async (id: string) => {
    try {
      const res = await api.syncSyndication(id);
      if (res.success) {
        setSyndications(prev => prev.map(s => s.id === id ? { ...s, ...res.syndication } : s));
      }
    } catch { /* ignore */ }
  };

  const handleDelist = async (id: string) => {
    try {
      const res = await api.delistSyndication(id);
      if (res.success) {
        setSyndications(prev => prev.map(s => s.id === id ? { ...s, ...res.syndication } : s));
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this syndication?')) return;
    try {
      await api.deleteSyndication(id);
      setSyndications(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  };

  const handleExport = async (id: string) => {
    setShowExport(id);
    setExportData(null);
    setExportFormat('csv');
  };

  const doExport = async () => {
    if (!showExport) return;
    setExporting(true);
    try {
      const res = await api.generateSyndicationExport(showExport, exportFormat);
      if (res.success) {
        setExportData(res.export);
      }
    } catch {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const downloadExport = () => {
    if (!exportData) return;
    const blob = new Blob([exportData.data], {
      type: exportFormat === 'csv' ? 'text/csv' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportData.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Stats
  const totalSyndicated = syndications.length;
  const published = syndications.filter(s => s.status === 'published' || s.status === 'synced').length;
  const errors = syndications.filter(s => s.status === 'error').length;
  const platformsInUse = new Set(syndications.map(s => s.platform_id)).size;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Syndication</h1>
            <p className="text-sm text-gray-500 mt-1">
              Publish your listings to external CRE platforms
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>+ Syndicate Listing</Button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalSyndicated}</p>
              <p className="text-xs text-gray-500 mt-1">Total Syndicated</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{published}</p>
              <p className="text-xs text-gray-500 mt-1">Published</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{errors}</p>
              <p className="text-xs text-gray-500 mt-1">Errors</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{platformsInUse}</p>
              <p className="text-xs text-gray-500 mt-1">Platforms in Use</p>
            </CardContent>
          </Card>
        </div>

        {/* Platform Overview */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Platforms</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {platforms.map(p => {
              const count = syndications.filter(s => s.platform_id === p.id).length;
              return (
                <Card key={p.id}>
                  <CardContent className="p-3 text-center">
                    <p className="font-semibold text-sm text-gray-900 truncate">{p.display_name}</p>
                    <Badge variant="default" className="mt-1 text-[10px]">
                      {INTEGRATION_BADGE[p.integration_type] || p.integration_type}
                    </Badge>
                    <p className="text-lg font-bold text-gray-700 mt-2">{count}</p>
                    <p className="text-[10px] text-gray-400">listings</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : syndications.length === 0 ? (
          <EmptyState
            title="No syndicated listings"
            description="Publish your listing sites to external CRE platforms like Crexi, LoopNet, and Brevitas."
            action={{ label: 'Syndicate Listing', onClick: () => setShowCreate(true) }}
          />
        ) : (
          /* Syndication Table */
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Platform</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Published</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Last Synced</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {syndications.map(s => {
                    const ls = s.listing_site as any;
                    const prop = ls?.master_properties;
                    const platform = s.platform;
                    const badge = STATUS_BADGE[s.status] || STATUS_BADGE.draft;

                    return (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[200px]">
                            {prop?.address || ls?.custom_headline || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {[prop?.city, prop?.state].filter(Boolean).join(', ')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-700">{platform?.display_name || '—'}</div>
                          <div className="text-[10px] text-gray-400">
                            {platform ? INTEGRATION_BADGE[platform.integration_type] : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {s.error_message && (
                            <p className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={s.error_message}>
                              {s.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {s.published_at ? new Date(s.published_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {s.last_synced_at ? new Date(s.last_synced_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {s.status === 'draft' && (
                              <button
                                onClick={() => handlePublish(s.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                              >
                                Publish
                              </button>
                            )}
                            {(s.status === 'published' || s.status === 'synced') && (
                              <>
                                <button
                                  onClick={() => handleSync(s.id)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                                >
                                  Sync
                                </button>
                                <button
                                  onClick={() => handleDelist(s.id)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"
                                >
                                  Delist
                                </button>
                              </>
                            )}
                            {platform && platform.integration_type !== 'api' && (
                              <button
                                onClick={() => handleExport(s.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                              >
                                Export
                              </button>
                            )}
                            {s.external_listing_url && (
                              <a
                                href={s.external_listing_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                              >
                                View
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Syndicate a Listing</h2>

              {/* Select listing site */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Listing Site</label>
                <select
                  value={selectedListingSiteId}
                  onChange={e => setSelectedListingSiteId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a listing site...</option>
                  {listingSites.map(ls => (
                    <option key={ls.id} value={ls.id}>
                      {(ls.master_properties as any)?.address || ls.custom_headline || ls.slug}
                      {ls.is_published ? ' (Published)' : ' (Draft)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select platform(s) */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Platforms (select one or more)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {platforms.map(p => {
                    const selected = selectedPlatformIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePlatform(p.id)}
                        className={`
                          p-3 rounded-lg border text-left transition-colors
                          ${selected
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="font-medium text-sm">{p.display_name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {INTEGRATION_BADGE[p.integration_type]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => {
                  setShowCreate(false);
                  setSelectedListingSiteId('');
                  setSelectedPlatformIds([]);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !selectedListingSiteId || selectedPlatformIds.length === 0}
                >
                  {creating ? 'Creating...' : selectedPlatformIds.length > 1 ? `Publish to ${selectedPlatformIds.length} Platforms` : 'Create Syndication'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowExport(null); setExportData(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Export for Platform Upload</h2>

              {!exportData ? (
                <>
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Format</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setExportFormat('csv')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          exportFormat === 'csv'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => setExportFormat('json')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          exportFormat === 'json'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        JSON
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => { setShowExport(null); setExportData(null); }}>
                      Cancel
                    </Button>
                    <Button onClick={doExport} disabled={exporting}>
                      {exporting ? 'Generating...' : 'Generate Export'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Export ready for <span className="font-medium">{exportData.platform_name}</span>
                    </p>
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto max-h-60 whitespace-pre-wrap">
                      {exportData.data}
                    </pre>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => { setShowExport(null); setExportData(null); }}>
                      Close
                    </Button>
                    <Button onClick={downloadExport}>
                      Download {exportData.file_name.split('.').pop()?.toUpperCase()}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
