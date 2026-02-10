import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, EmptyState } from '../components/ui';
import {
  TemplateType,
  ContentType,
  GenerateContentResponse,
  MasterProperty,
} from '../types';
import {
  generateBrochurePDF,
  generateOMPDF,
  generateProposalPDF,
  ThemeStyle,
  COMPANY_BRANDS,
  getCompanyBrand,
  CompanyBrand,
} from '../utils/pdfBuilder';

// Content types required per template
const TEMPLATE_CONTENT_TYPES: Record<TemplateType, ContentType[]> = {
  brochure: ['property_description', 'property_highlights', 'executive_summary', 'location_analysis'],
  om: ['property_description', 'property_highlights', 'executive_summary', 'location_analysis'],
  proposal: ['property_description', 'property_highlights', 'market_analysis', 'team_intro'],
};

const TEMPLATE_INFO: { type: TemplateType; label: string; description: string; pages: string; icon: string }[] = [
  {
    type: 'brochure',
    label: 'Property Brochure',
    description: 'Professional marketing brochure with cover page, executive summary, property details, location overview, and contact page.',
    pages: '4-6 pages',
    icon: 'brochure',
  },
  {
    type: 'om',
    label: 'Offering Memorandum',
    description: 'Comprehensive investment package with cover, table of contents, executive summary, financials, location analysis, and confidentiality notice.',
    pages: '6-10 pages',
    icon: 'om',
  },
  {
    type: 'proposal',
    label: 'Investment Proposal',
    description: 'Client-facing proposal with company intro, market analysis, property recommendation, next steps, and contact page.',
    pages: '4-6 pages',
    icon: 'proposal',
  },
];

const TEMPLATE_LABELS: Record<string, string> = {
  brochure: 'Brochure',
  om: 'Offering Memorandum',
  proposal: 'Proposal',
};

interface SavedDoc {
  id: string;
  master_property_id: string | null;
  template_type: string;
  title: string;
  content_snapshot: any;
  created_at: string;
  master_properties?: {
    address: string;
    city: string;
    state: string;
    property_name: string | null;
  } | null;
}

type PageView = 'dashboard' | 'wizard';
type WizardStep = 'select-template' | 'select-company' | 'select-property' | 'generate-content' | 'export';
type PropertyTab = 'search' | 'browse' | 'manual';

const PROPERTY_TYPE_OPTIONS = [
  'industrial', 'retail', 'office', 'multifamily', 'land', 'residential', 'special_purpose',
] as const;

export default function DocumentGenerator() {
  const { user } = useAuth();

  // Page view
  const [view, setView] = useState<PageView>('dashboard');

  // Dashboard state
  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');

  // Wizard state
  const [step, setStep] = useState<WizardStep>('select-template');

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);

  // Company brand
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>('apex');
  const [selectedStyle, setSelectedStyle] = useState<ThemeStyle>('apex');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [customPrimary, setCustomPrimary] = useState<string>('#323232');
  const [customAccent, setCustomAccent] = useState<string>('#646464');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Property search
  const [propertyTab, setPropertyTab] = useState<PropertyTab>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState<MasterProperty[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<MasterProperty | null>(null);

  // Browse tab
  const [browseProperties, setBrowseProperties] = useState<MasterProperty[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [browseHasMore, setBrowseHasMore] = useState(true);

  // Manual entry
  const [manualForm, setManualForm] = useState({
    address: '', city: '', state: 'CA', zip: '', property_type: 'industrial',
    building_size: '', year_built: '', sale_price: '', cap_rate: '',
  });
  const [manualSaving, setManualSaving] = useState(false);

  // Content generation
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [propertyData, setPropertyData] = useState<any>(null);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // Export
  const [saving, setSaving] = useState(false);

  // Pre-fill contact info from user profile
  useEffect(() => {
    if (user) {
      setContactName(user.full_name || '');
      setContactPhone(user.company_phone || '');
      setContactEmail(user.company_email || user.email || '');
    }
  }, [user]);

  // Load saved documents on mount
  useEffect(() => {
    loadSavedDocs();
  }, []);

  const loadSavedDocs = async () => {
    setDocsLoading(true);
    try {
      const result: any = await api.listGeneratedDocs();
      setSavedDocs(result.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setDocsLoading(false);
    }
  };

  // Search properties
  const fetchProperties = useCallback(async (search: string) => {
    if (!search.trim()) {
      setProperties([]);
      return;
    }
    setSearchLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const params = new URLSearchParams({ limit: '20', offset: '0', search });
      const res = await fetch(`${apiBase}/master-properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProperties(data.properties || []);
      }
    } catch (err) {
      console.error('Failed to search properties:', err);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        fetchProperties(searchQuery);
      } else {
        setProperties([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchProperties]);

  // Browse all properties
  const loadBrowseProperties = useCallback(async (offset: number, append: boolean) => {
    setBrowseLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const params = new URLSearchParams({ limit: '20', offset: String(offset) });
      const res = await fetch(`${apiBase}/master-properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const props = data.properties || [];
        setBrowseProperties(prev => append ? [...prev, ...props] : props);
        setBrowseHasMore(props.length === 20);
        setBrowseOffset(offset + props.length);
      }
    } catch (err) {
      console.error('Failed to browse properties:', err);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  // Load browse tab on first switch
  useEffect(() => {
    if (propertyTab === 'browse' && browseProperties.length === 0) {
      loadBrowseProperties(0, false);
    }
  }, [propertyTab, browseProperties.length, loadBrowseProperties]);

  // Handle logo upload
  const handleLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle manual property creation
  const handleManualCreate = async () => {
    if (!manualForm.address.trim() || !manualForm.city.trim()) {
      alert('Address and city are required');
      return;
    }
    setManualSaving(true);
    try {
      const payload: Record<string, unknown> = {
        address: manualForm.address,
        city: manualForm.city,
        state: manualForm.state || 'CA',
        zip: manualForm.zip || undefined,
        property_type: manualForm.property_type,
      };
      if (manualForm.building_size) payload.building_size = Number(manualForm.building_size);
      if (manualForm.year_built) payload.year_built = Number(manualForm.year_built);
      if (manualForm.sale_price) payload.sale_price = Number(manualForm.sale_price);
      if (manualForm.cap_rate) payload.cap_rate = Number(manualForm.cap_rate);

      const result: any = await api.createMasterProperty(payload);
      if (result.success && result.property) {
        setSelectedProperty(result.property);
        setStep('generate-content');
      }
    } catch (err: any) {
      alert(`Failed to create property: ${err.message}`);
    } finally {
      setManualSaving(false);
    }
  };

  // Get current brand
  const getSelectedBrand = (): CompanyBrand | undefined => getCompanyBrand(selectedCompanyKey);

  // Get style prompt from selected brand
  const getStylePrompt = (): string | undefined => {
    const brand = getSelectedBrand();
    return brand?.stylePrompt || undefined;
  };

  // Generate content
  const handleGenerate = async () => {
    if (!selectedProperty || !selectedTemplate) return;
    setGenerating(true);
    setContentError(null);

    try {
      const contentTypes = TEMPLATE_CONTENT_TYPES[selectedTemplate];
      const stylePrompt = getStylePrompt();
      const response: GenerateContentResponse = await api.generateDocContent(
        selectedProperty.id,
        contentTypes,
        stylePrompt
      );

      const contentMap: Record<string, string> = {};
      for (const [key, val] of Object.entries(response.content)) {
        contentMap[key] = val.content || '';
      }
      setGeneratedContent(contentMap);
      setPropertyData(response.property);
      setTransactionData(response.transaction);
      setStep('export');
    } catch (err: any) {
      console.error('Content generation failed:', err);
      setContentError(err.message || 'Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  // Build PDF
  const buildPdfOptions = () => {
    const opts: any = {
      property: propertyData,
      transaction: transactionData,
      content: generatedContent,
      companyName: contactName || user?.company_name || 'Apex Real Estate Services',
      companyPhone: contactPhone || user?.company_phone,
      companyEmail: contactEmail || user?.company_email,
      companyAddress: user?.company_address,
      style: selectedStyle,
    };
    if (logoBase64) opts.logoBase64 = logoBase64;
    if (selectedCompanyKey === 'custom') {
      opts.customPrimary = hexToRgb(customPrimary);
      opts.customAccent = hexToRgb(customAccent);
    }
    return opts;
  };

  const buildPdf = () => {
    if (!selectedTemplate || !propertyData) return null;
    const options = buildPdfOptions();
    switch (selectedTemplate) {
      case 'brochure': return generateBrochurePDF(options);
      case 'om': return generateOMPDF(options);
      case 'proposal': return generateProposalPDF(options);
    }
  };

  const handleExportPDF = () => {
    const doc = buildPdf();
    if (!doc) return;
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  };

  const handleDownloadPDF = () => {
    const doc = buildPdf();
    if (!doc || !propertyData) return;
    const filename = `${selectedTemplate}_${propertyData.address || 'property'}_${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    doc.save(filename);
  };

  const handleSaveRecord = async () => {
    if (!selectedProperty || !selectedTemplate) return;
    setSaving(true);
    try {
      const title = `${selectedTemplate.toUpperCase()} - ${selectedProperty.address || 'Property'} - ${new Date().toLocaleDateString()}`;
      await api.saveGeneratedDoc({
        master_property_id: selectedProperty.id,
        template_type: selectedTemplate,
        title,
        content_snapshot: { content: generatedContent, property: propertyData, transaction: transactionData },
      });
      await loadSavedDocs();
      handleReset();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Re-open a saved document for export
  const handleOpenSavedDoc = (doc: SavedDoc) => {
    if (!doc.content_snapshot) return;
    const snapshot = doc.content_snapshot as any;
    setGeneratedContent(snapshot.content || {});
    setPropertyData(snapshot.property || null);
    setTransactionData(snapshot.transaction || null);
    setSelectedTemplate(doc.template_type as TemplateType);
    setSelectedStyle('apex');
    setStep('export');
    setView('wizard');
    if (doc.master_properties) {
      setSelectedProperty({
        id: doc.master_property_id!,
        address: doc.master_properties.address,
        city: doc.master_properties.city,
        state: doc.master_properties.state,
        property_name: doc.master_properties.property_name,
      } as MasterProperty);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.deleteGeneratedDoc(docId);
      setSavedDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleReset = () => {
    setView('dashboard');
    setStep('select-template');
    setSelectedProperty(null);
    setSelectedTemplate(null);
    setSelectedStyle('apex');
    setSelectedCompanyKey('apex');
    setLogoBase64(null);
    setGeneratedContent({});
    setPropertyData(null);
    setTransactionData(null);
    setContentError(null);
    setSearchQuery('');
    setProperties([]);
    setPropertyTab('search');
    setBrowseProperties([]);
    setBrowseOffset(0);
    setBrowseHasMore(true);
    setManualForm({ address: '', city: '', state: 'CA', zip: '', property_type: 'industrial', building_size: '', year_built: '', sale_price: '', cap_rate: '' });
  };

  const formatCurrency = (v?: number) => {
    if (!v) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const filteredDocs = filterType
    ? savedDocs.filter((d) => d.template_type === filterType)
    : savedDocs;

  // Utility: hex to rgb tuple
  function hexToRgb(hex: string): [number, number, number] {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16) || 0;
    const g = parseInt(cleaned.substring(2, 4), 16) || 0;
    const b = parseInt(cleaned.substring(4, 6), 16) || 0;
    return [r, g, b];
  }

  function rgbToHex(rgb: [number, number, number]): string {
    return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  }

  // Select property and advance
  const handleSelectProperty = (prop: MasterProperty) => {
    setSelectedProperty(prop);
    setStep('generate-content');
  };

  // Select company and advance
  const handleSelectCompany = (key: string) => {
    setSelectedCompanyKey(key);
    setSelectedStyle(key as ThemeStyle);
    // Don't auto-advance — let user upload logo and fill contact info first
  };

  // Wizard step labels
  const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
    { key: 'select-template', label: '1. Template' },
    { key: 'select-company', label: '2. Company' },
    { key: 'select-property', label: '3. Property' },
    { key: 'generate-content', label: '4. Generate' },
    { key: 'export', label: '5. Export' },
  ];

  const STEP_ORDER: WizardStep[] = ['select-template', 'select-company', 'select-property', 'generate-content', 'export'];

  // ─── Dashboard View ───
  if (view === 'dashboard') {
    return (
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
              <p className="text-sm text-gray-500 mt-1">
                Create and manage brochures, offering memorandums, and proposals
              </p>
            </div>
            <Button
              onClick={() => { setView('wizard'); setStep('select-template'); }}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              New Document
            </Button>
          </div>

          {/* Stats */}
          {savedDocs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{savedDocs.length}</p>
                  <p className="text-xs text-gray-500">Total Documents</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{savedDocs.filter(d => d.template_type === 'brochure').length}</p>
                  <p className="text-xs text-gray-500">Brochures</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{savedDocs.filter(d => d.template_type === 'om').length}</p>
                  <p className="text-xs text-gray-500">OMs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{savedDocs.filter(d => d.template_type === 'proposal').length}</p>
                  <p className="text-xs text-gray-500">Proposals</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter tabs */}
          {savedDocs.length > 0 && (
            <div className="flex gap-2">
              {[
                { value: '', label: 'All' },
                { value: 'brochure', label: 'Brochures' },
                { value: 'om', label: 'OMs' },
                { value: 'proposal', label: 'Proposals' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilterType(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === tab.value
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Documents list */}
          {docsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
                <p className="mt-3 text-gray-500 text-sm">Loading documents...</p>
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              title={savedDocs.length === 0 ? 'No documents yet' : 'No matching documents'}
              description={savedDocs.length === 0
                ? 'Create your first brochure, OM, or proposal to get started'
                : 'Try a different filter'
              }
              action={savedDocs.length === 0 ? {
                label: 'Create First Document',
                onClick: () => { setView('wizard'); setStep('select-template'); },
              } : undefined}
              icon={
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => {
                const propName = doc.master_properties
                  ? (doc.master_properties.property_name || doc.master_properties.address)
                  : (doc.content_snapshot?.property?.address || 'Unknown Property');
                const propLocation = doc.master_properties
                  ? `${doc.master_properties.city}, ${doc.master_properties.state}`
                  : '';

                return (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            doc.template_type === 'brochure' ? 'bg-blue-100' :
                            doc.template_type === 'om' ? 'bg-purple-100' : 'bg-green-100'
                          }`}>
                            {doc.template_type === 'brochure' && (
                              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                              </svg>
                            )}
                            {doc.template_type === 'om' && (
                              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                            {doc.template_type === 'proposal' && (
                              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{propName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant={
                                doc.template_type === 'brochure' ? 'info' :
                                doc.template_type === 'om' ? 'primary' : 'success'
                              } size="sm">
                                {TEMPLATE_LABELS[doc.template_type] || doc.template_type}
                              </Badge>
                              {propLocation && (
                                <span className="text-xs text-gray-500">{propLocation}</span>
                              )}
                              <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.content_snapshot && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSavedDoc(doc)}
                              title="Open & export"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ─── Wizard View ───
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {step === 'export' ? 'Export Document' : 'New Document'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create professional brochures, offering memorandums, and proposals
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Back to Documents
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-gray-300" />}
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  step === s.key
                    ? 'bg-primary-100 text-primary-700'
                    : STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(s.key)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Select Template */}
        {step === 'select-template' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">What do you want to create?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TEMPLATE_INFO.map((tmpl) => (
                <button
                  key={tmpl.type}
                  onClick={() => {
                    setSelectedTemplate(tmpl.type);
                    setStep('select-company');
                  }}
                  className="text-left group"
                >
                  <Card className="h-full hover:border-primary-400 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-6 space-y-4">
                      {/* Preview thumbnail */}
                      <div className="w-full h-32 bg-gray-50 rounded-lg border border-gray-200 flex flex-col overflow-hidden">
                        <div className={`h-8 ${
                          tmpl.type === 'brochure' ? 'bg-blue-600' :
                          tmpl.type === 'om' ? 'bg-purple-600' : 'bg-green-600'
                        }`} />
                        <div className="flex-1 p-3 space-y-2">
                          <div className="h-2 bg-gray-200 rounded w-3/4" />
                          <div className="h-2 bg-gray-200 rounded w-full" />
                          <div className="h-2 bg-gray-200 rounded w-5/6" />
                          <div className="h-2 bg-gray-200 rounded w-2/3" />
                          <div className="flex gap-2 mt-2">
                            <div className="h-6 bg-gray-100 rounded flex-1" />
                            <div className="h-6 bg-gray-100 rounded flex-1" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          {tmpl.type === 'brochure' && (
                            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                          )}
                          {tmpl.type === 'om' && (
                            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          {tmpl.type === 'proposal' && (
                            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          )}
                        </div>
                        <Badge variant="default">{tmpl.pages}</Badge>
                      </div>
                      <h3 className="font-semibold text-gray-900">{tmpl.label}</h3>
                      <p className="text-sm text-gray-500">{tmpl.description}</p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Company Brand */}
        {step === 'select-company' && selectedTemplate && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Company Branding</h2>
              <button onClick={() => setStep('select-template')} className="text-sm text-primary-600 hover:text-primary-700">
                Change Template
              </button>
            </div>

            {/* Company cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COMPANY_BRANDS.map((brand) => (
                <button
                  key={brand.key}
                  onClick={() => handleSelectCompany(brand.key)}
                  className={`text-left p-4 border-2 rounded-xl transition-all ${
                    selectedCompanyKey === brand.key
                      ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-5 h-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: rgbToHex(brand.primary) }}
                    />
                    <div
                      className="w-5 h-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: rgbToHex(brand.accent) }}
                    />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{brand.displayName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{brand.description}</p>
                </button>
              ))}
            </div>

            {/* Custom color pickers */}
            {selectedCompanyKey === 'custom' && (
              <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Primary Color</label>
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Accent Color</label>
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                  />
                </div>
              </div>
            )}

            {/* Logo upload */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Company Logo (optional)</h3>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
                onClick={() => logoInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
                    handleLogoFile(file);
                  }
                }}
              >
                {logoBase64 ? (
                  <div className="flex items-center justify-center gap-4">
                    <img src={logoBase64} alt="Logo preview" className="h-12 object-contain" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setLogoBase64(null); }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">Drop a PNG or JPG here, or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">Max 2MB</p>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoFile(file);
                  }}
                />
              </div>
            </div>

            {/* Contact info */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Contact Info (appears on documents)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <Button onClick={() => setStep('select-property')}>
              Continue to Property Selection
            </Button>
          </div>
        )}

        {/* Step 3: Select Property */}
        {step === 'select-property' && selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Select a Property</h2>
              <button onClick={() => setStep('select-company')} className="text-sm text-primary-600 hover:text-primary-700">
                Change Company
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([
                { key: 'search' as PropertyTab, label: 'Search' },
                { key: 'browse' as PropertyTab, label: 'Browse All' },
                { key: 'manual' as PropertyTab, label: 'Enter Manually' },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPropertyTab(tab.key)}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    propertyTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search tab */}
            {propertyTab === 'search' && (
              <Card>
                <CardContent className="space-y-4">
                  <input
                    type="text"
                    placeholder="Search by address, city, or property name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />

                  {searchLoading && (
                    <p className="text-sm text-gray-500">Searching...</p>
                  )}

                  {!searchLoading && properties.length === 0 && searchQuery.length >= 2 && (
                    <p className="text-sm text-gray-500">No properties found. Try a different search.</p>
                  )}

                  {properties.length > 0 && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {properties.map((prop) => (
                        <PropertyCard key={prop.id} property={prop} onSelect={handleSelectProperty} />
                      ))}
                    </div>
                  )}

                  {!searchQuery && (
                    <EmptyState
                      title="Search for a Property"
                      description="Enter an address or property name to get started"
                      icon={
                        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Browse tab */}
            {propertyTab === 'browse' && (
              <Card>
                <CardContent className="space-y-4">
                  {browseLoading && browseProperties.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent"></div>
                    </div>
                  ) : browseProperties.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No properties in database. Use the "Enter Manually" tab to add one.</p>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {browseProperties.map((prop) => (
                          <PropertyCard key={prop.id} property={prop} onSelect={handleSelectProperty} />
                        ))}
                      </div>
                      {browseHasMore && (
                        <div className="text-center pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadBrowseProperties(browseOffset, true)}
                            disabled={browseLoading}
                          >
                            {browseLoading ? 'Loading...' : 'Load More'}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Manual entry tab */}
            {propertyTab === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle>Create a New Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                      <input
                        type="text"
                        value={manualForm.address}
                        onChange={(e) => setManualForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="123 Main St"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                      <input
                        type="text"
                        value={manualForm.city}
                        onChange={(e) => setManualForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Ontario"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={manualForm.state}
                        onChange={(e) => setManualForm(f => ({ ...f, state: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
                      <input
                        type="text"
                        value={manualForm.zip}
                        onChange={(e) => setManualForm(f => ({ ...f, zip: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                      <select
                        value={manualForm.property_type}
                        onChange={(e) => setManualForm(f => ({ ...f, property_type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {PROPERTY_TYPE_OPTIONS.map(t => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Building Size (SF)</label>
                      <input
                        type="number"
                        value={manualForm.building_size}
                        onChange={(e) => setManualForm(f => ({ ...f, building_size: e.target.value }))}
                        placeholder="50000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year Built</label>
                      <input
                        type="number"
                        value={manualForm.year_built}
                        onChange={(e) => setManualForm(f => ({ ...f, year_built: e.target.value }))}
                        placeholder="2005"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                      <input
                        type="number"
                        value={manualForm.sale_price}
                        onChange={(e) => setManualForm(f => ({ ...f, sale_price: e.target.value }))}
                        placeholder="5000000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CAP Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={manualForm.cap_rate}
                        onChange={(e) => setManualForm(f => ({ ...f, cap_rate: e.target.value }))}
                        placeholder="5.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <Button onClick={handleManualCreate} disabled={manualSaving}>
                    {manualSaving ? 'Creating...' : 'Create & Continue'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: Generate Content */}
        {step === 'generate-content' && selectedProperty && selectedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>Generate Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedProperty.property_name || selectedProperty.address}
                    </p>
                    <p className="text-sm text-gray-500">
                      Template: {TEMPLATE_INFO.find(t => t.type === selectedTemplate)?.label}
                      {' | '}Company: {getSelectedBrand()?.displayName || selectedCompanyKey}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('select-property')}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Change Property
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                AI will generate the following content sections:
              </p>

              <div className="flex flex-wrap gap-2">
                {TEMPLATE_CONTENT_TYPES[selectedTemplate].map((ct) => (
                  <Badge key={ct} variant="info">
                    {ct.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>

              {contentError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {contentError}
                </div>
              )}

              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating with AI...
                  </span>
                ) : (
                  'Generate Content'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Export */}
        {step === 'export' && selectedTemplate && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {TEMPLATE_INFO.find(t => t.type === selectedTemplate)?.label} Ready
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Your content has been generated. You can edit it below, then preview or download the PDF.
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleExportPDF}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview PDF
                  </Button>
                  <Button variant="outline" onClick={handleDownloadPDF}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF
                  </Button>
                  {selectedProperty && (
                    <Button variant="outline" onClick={handleSaveRecord} disabled={saving}>
                      {saving ? 'Saving...' : 'Save & Close'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Editable content sections */}
            <Card>
              <CardHeader>
                <CardTitle>Edit Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(generatedContent).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <textarea
                      value={value}
                      onChange={(e) =>
                        setGeneratedContent((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      rows={key === 'property_highlights' ? 6 : 5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    {key === 'property_highlights' && (
                      <p className="text-xs text-gray-400 mt-1">
                        JSON array format: ["highlight 1", "highlight 2", ...]
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Property metrics preview */}
            {propertyData && (
              <Card>
                <CardHeader>
                  <CardTitle>Property Data in PDF</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {propertyData.building_size && (
                      <div>
                        <p className="text-xs text-gray-500">Building Size</p>
                        <p className="font-semibold">{propertyData.building_size.toLocaleString()} SF</p>
                      </div>
                    )}
                    {propertyData.year_built && (
                      <div>
                        <p className="text-xs text-gray-500">Year Built</p>
                        <p className="font-semibold">{propertyData.year_built}</p>
                      </div>
                    )}
                    {propertyData.clear_height_ft && (
                      <div>
                        <p className="text-xs text-gray-500">Clear Height</p>
                        <p className="font-semibold">{propertyData.clear_height_ft} ft</p>
                      </div>
                    )}
                    {transactionData?.sale_price && (
                      <div>
                        <p className="text-xs text-gray-500">Sale Price</p>
                        <p className="font-semibold">{formatCurrency(transactionData.sale_price)}</p>
                      </div>
                    )}
                    {transactionData?.asking_price && (
                      <div>
                        <p className="text-xs text-gray-500">Asking Price</p>
                        <p className="font-semibold">{formatCurrency(transactionData.asking_price)}</p>
                      </div>
                    )}
                    {transactionData?.cap_rate && (
                      <div>
                        <p className="text-xs text-gray-500">CAP Rate</p>
                        <p className="font-semibold">{transactionData.cap_rate}%</p>
                      </div>
                    )}
                    {transactionData?.price_per_sf && (
                      <div>
                        <p className="text-xs text-gray-500">Price/SF</p>
                        <p className="font-semibold">{formatCurrency(transactionData.price_per_sf)}</p>
                      </div>
                    )}
                    {propertyData.percent_leased != null && (
                      <div>
                        <p className="text-xs text-gray-500">Leased</p>
                        <p className="font-semibold">{propertyData.percent_leased}%</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Reusable property card for search + browse
function PropertyCard({ property, onSelect }: { property: MasterProperty; onSelect: (p: MasterProperty) => void }) {
  return (
    <button
      onClick={() => onSelect(property)}
      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">
            {property.property_name || property.address}
          </p>
          <p className="text-sm text-gray-500">
            {property.city}, {property.state} {property.zip}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="default">
            {(property.property_type || 'commercial').replace(/_/g, ' ')}
          </Badge>
          {property.building_size && (
            <p className="text-xs text-gray-500 mt-1">
              {property.building_size.toLocaleString()} SF
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
