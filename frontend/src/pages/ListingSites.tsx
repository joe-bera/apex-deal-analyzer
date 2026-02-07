import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { Card, CardContent, Button, Badge, EmptyState, Input } from '../components/ui';
import { ListingSite, ListingLead, MasterProperty } from '../types';

export default function ListingSites() {
  const [sites, setSites] = useState<ListingSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MasterProperty[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<MasterProperty | null>(null);
  const [createForm, setCreateForm] = useState({
    lead_capture_email: '',
    custom_headline: '',
    custom_description: '',
    virtual_tour_url: '',
  });
  const [creating, setCreating] = useState(false);

  // Leads view
  const [expandedLeads, setExpandedLeads] = useState<string | null>(null);
  const [leads, setLeads] = useState<Record<string, ListingLead[]>>({});
  const [leadsLoading, setLeadsLoading] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    try {
      const res = await api.listListingSites();
      if (res.success) {
        setSites(res.listing_sites);
      }
    } catch {
      setError('Failed to load listing sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const searchProperties = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const params = new URLSearchParams({ search: q, limit: '10', offset: '0' });
      const res = await fetch(`${apiBase}/master-properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.properties || []);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchProperties(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProperties]);

  const handleCreate = async () => {
    if (!selectedProperty) return;
    setCreating(true);
    try {
      const res = await api.createListingSite({
        master_property_id: selectedProperty.id,
        ...createForm,
      });
      if (res.success) {
        setSites(prev => [res.listing_site, ...prev]);
        setShowCreate(false);
        setSelectedProperty(null);
        setSearchQuery('');
        setCreateForm({ lead_capture_email: '', custom_headline: '', custom_description: '', virtual_tour_url: '' });
      }
    } catch {
      setError('Failed to create listing site');
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (site: ListingSite) => {
    try {
      const res = await api.updateListingSite(site.id, { is_published: !site.is_published });
      if (res.success) {
        setSites(prev => prev.map(s => s.id === site.id ? res.listing_site : s));
      }
    } catch {
      // ignore
    }
  };

  const deleteSite = async (id: string) => {
    if (!confirm('Delete this listing site?')) return;
    try {
      await api.deleteListingSite(id);
      setSites(prev => prev.filter(s => s.id !== id));
    } catch {
      // ignore
    }
  };

  const loadLeads = async (siteId: string) => {
    if (expandedLeads === siteId) {
      setExpandedLeads(null);
      return;
    }
    setExpandedLeads(siteId);
    if (leads[siteId]) return;
    setLeadsLoading(siteId);
    try {
      const res = await api.getListingLeads(siteId);
      if (res.success) {
        setLeads(prev => ({ ...prev, [siteId]: res.leads }));
      }
    } catch {
      // ignore
    } finally {
      setLeadsLoading(null);
    }
  };

  const getPublicUrl = (slug: string) => {
    const base = window.location.origin;
    return `${base}/listing/${slug}`;
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(getPublicUrl(slug));
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Listing Sites</h1>
            <p className="text-sm text-gray-500 mt-1">Create branded landing pages for your properties</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            + New Listing Site
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sites.length === 0 ? (
          <EmptyState
            title="No listing sites yet"
            description="Create a branded landing page for any property in your portfolio."
            action={{ label: 'Create Listing Site', onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="grid gap-4">
            {sites.map(site => {
              const prop = site.master_properties;
              return (
                <Card key={site.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {prop?.address || 'Unknown Property'}
                          </h3>
                          <Badge variant={site.is_published ? 'success' : 'default'}>
                            {site.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {[prop?.city, prop?.state, prop?.zip].filter(Boolean).join(', ')}
                          {prop?.property_type && ` \u00B7 ${prop.property_type.replace(/_/g, ' ')}`}
                          {prop?.building_size && ` \u00B7 ${prop.building_size.toLocaleString()} SF`}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>/{site.slug}</span>
                          <span>{site.view_count} views</span>
                          <span>{site.lead_count} leads</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyUrl(site.slug)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Copy public URL"
                        >
                          Copy URL
                        </button>
                        <a
                          href={getPublicUrl(site.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Open
                        </a>
                        <button
                          onClick={() => togglePublish(site)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            site.is_published
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'text-green-700 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {site.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => loadLeads(site.id)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Leads ({site.lead_count})
                        </button>
                        <button
                          onClick={() => deleteSite(site.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Expanded Leads */}
                    {expandedLeads === site.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Lead Submissions</h4>
                        {leadsLoading === site.id ? (
                          <p className="text-sm text-gray-400">Loading...</p>
                        ) : !leads[site.id] || leads[site.id].length === 0 ? (
                          <p className="text-sm text-gray-400">No leads yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {leads[site.id].map(lead => (
                              <div key={lead.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                                <div className="flex justify-between">
                                  <div>
                                    <span className="font-medium text-gray-900">{lead.name}</span>
                                    <span className="text-gray-500 ml-2">{lead.email}</span>
                                    {lead.phone && <span className="text-gray-400 ml-2">{lead.phone}</span>}
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    {new Date(lead.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {lead.company && <div className="text-gray-500 text-xs mt-1">{lead.company}</div>}
                                {lead.message && <div className="text-gray-600 mt-1">{lead.message}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Create Listing Site</h2>

              {/* Property Search */}
              {!selectedProperty ? (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Select Property</label>
                  <Input
                    placeholder="Search by address, city..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  />
                  {searching && <p className="text-xs text-gray-400 mt-2">Searching...</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProperty(p);
                            setSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-sm font-medium text-gray-900">{p.address}</div>
                          <div className="text-xs text-gray-500">
                            {[p.city, p.state].filter(Boolean).join(', ')}
                            {p.building_size && ` \u00B7 ${p.building_size.toLocaleString()} SF`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{selectedProperty.address}</div>
                      <div className="text-xs text-gray-500">{[selectedProperty.city, selectedProperty.state].filter(Boolean).join(', ')}</div>
                    </div>
                    <button onClick={() => setSelectedProperty(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Lead Capture Email</label>
                      <Input
                        type="email"
                        placeholder="leads@yourcompany.com"
                        value={createForm.lead_capture_email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(f => ({ ...f, lead_capture_email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Custom Headline (optional)</label>
                      <Input
                        placeholder="e.g., Prime Industrial Space Available"
                        value={createForm.custom_headline}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(f => ({ ...f, custom_headline: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Custom Description (optional)</label>
                      <textarea
                        rows={3}
                        placeholder="Property description for the listing page..."
                        value={createForm.custom_description}
                        onChange={e => setCreateForm(f => ({ ...f, custom_description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Virtual Tour URL (optional)</label>
                      <Input
                        type="url"
                        placeholder="https://my3dtour.com/..."
                        value={createForm.virtual_tour_url}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(f => ({ ...f, virtual_tour_url: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating ? 'Creating...' : 'Create Listing'}
                    </Button>
                  </div>
                </>
              )}

              {!selectedProperty && (
                <div className="flex justify-end mt-4">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
