import { useState, useEffect, useCallback } from 'react';
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
import { generateBrochurePDF, generateOMPDF, generateProposalPDF, ThemeStyle } from '../utils/pdfBuilder';

// Content types required per template
const TEMPLATE_CONTENT_TYPES: Record<TemplateType, ContentType[]> = {
  brochure: ['property_description', 'property_highlights', 'executive_summary', 'location_analysis'],
  om: ['property_description', 'property_highlights', 'executive_summary', 'location_analysis'],
  proposal: ['property_description', 'property_highlights', 'market_analysis', 'team_intro'],
};

const TEMPLATE_INFO: { type: TemplateType; label: string; description: string; pages: string }[] = [
  {
    type: 'brochure',
    label: 'Property Brochure',
    description: 'Professional marketing brochure with cover page, executive summary, property details, location overview, and contact page.',
    pages: '4-6 pages',
  },
  {
    type: 'om',
    label: 'Offering Memorandum',
    description: 'Comprehensive investment package with cover, table of contents, executive summary, financials, location analysis, and confidentiality notice.',
    pages: '6-10 pages',
  },
  {
    type: 'proposal',
    label: 'Investment Proposal',
    description: 'Client-facing proposal with company intro, market analysis, property recommendation, next steps, and contact page.',
    pages: '4-6 pages',
  },
];

const STYLE_INFO: { style: ThemeStyle; label: string; description: string }[] = [
  {
    style: 'apex',
    label: 'Apex Maroon',
    description: 'Deep maroon with red accents — classic Apex branding',
  },
  {
    style: 'modern',
    label: 'Modern Dark',
    description: 'Charcoal black with red accents — sleek and contemporary',
  },
  {
    style: 'corporate',
    label: 'Corporate Blue',
    description: 'Navy blue with teal accents — professional and corporate',
  },
];

type WizardStep = 'select-property' | 'select-template' | 'generate-content' | 'export';

export default function DocumentGenerator() {
  const { user } = useAuth();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('select-property');

  // Property search
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState<MasterProperty[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<MasterProperty | null>(null);

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ThemeStyle>('apex');

  // Content generation
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [propertyData, setPropertyData] = useState<any>(null);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // Export
  const [saving, setSaving] = useState(false);

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

  // Generate content
  const handleGenerate = async () => {
    if (!selectedProperty || !selectedTemplate) return;
    setGenerating(true);
    setContentError(null);

    try {
      const contentTypes = TEMPLATE_CONTENT_TYPES[selectedTemplate];
      const response: GenerateContentResponse = await api.generateDocContent(
        selectedProperty.id,
        contentTypes
      );

      // Extract content strings
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

  // Build PDF generation options
  const buildPdfOptions = () => ({
    property: propertyData,
    transaction: transactionData,
    content: generatedContent,
    companyName: user?.company_name || 'Apex Real Estate Services',
    companyPhone: user?.company_phone,
    companyEmail: user?.company_email,
    companyAddress: user?.company_address,
    style: selectedStyle,
  });

  const buildPdf = () => {
    if (!selectedTemplate || !propertyData) return null;
    const options = buildPdfOptions();
    switch (selectedTemplate) {
      case 'brochure': return generateBrochurePDF(options);
      case 'om': return generateOMPDF(options);
      case 'proposal': return generateProposalPDF(options);
    }
  };

  // Generate and open PDF
  const handleExportPDF = () => {
    const doc = buildPdf();
    if (!doc) return;
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  };

  // Download PDF
  const handleDownloadPDF = () => {
    const doc = buildPdf();
    if (!doc || !propertyData) return;
    const filename = `${selectedTemplate}_${propertyData.address || 'property'}_${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    doc.save(filename);
  };

  // Save document record
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
      alert('Document saved successfully!');
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setStep('select-property');
    setSelectedProperty(null);
    setSelectedTemplate(null);
    setSelectedStyle('apex');
    setGeneratedContent({});
    setPropertyData(null);
    setTransactionData(null);
    setContentError(null);
    setSearchQuery('');
    setProperties([]);
  };

  const formatCurrency = (v?: number) => {
    if (!v) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Generator</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create professional brochures, offering memorandums, and proposals
            </p>
          </div>
          {step !== 'select-property' && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              Start Over
            </Button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: 'select-property', label: '1. Select Property' },
            { key: 'select-template', label: '2. Choose Template' },
            { key: 'generate-content', label: '3. Generate Content' },
            { key: 'export', label: '4. Export PDF' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-gray-300" />}
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  step === s.key
                    ? 'bg-primary-100 text-primary-700'
                    : ['select-property', 'select-template', 'generate-content', 'export'].indexOf(step) >
                      ['select-property', 'select-template', 'generate-content', 'export'].indexOf(s.key)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Select Property */}
        {step === 'select-property' && (
          <Card>
            <CardHeader>
              <CardTitle>Select a Property</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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
                      <button
                        key={prop.id}
                        onClick={() => {
                          setSelectedProperty(prop);
                          setStep('select-template');
                        }}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {prop.property_name || prop.address}
                            </p>
                            <p className="text-sm text-gray-500">
                              {prop.city}, {prop.state} {prop.zip}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="default">
                              {(prop.property_type || 'commercial').replace(/_/g, ' ')}
                            </Badge>
                            {prop.building_size && (
                              <p className="text-xs text-gray-500 mt-1">
                                {prop.building_size.toLocaleString()} SF
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Template */}
        {step === 'select-template' && selectedProperty && (
          <div className="space-y-4">
            {/* Selected property card */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedProperty.property_name || selectedProperty.address}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
                      {selectedProperty.building_size && ` | ${selectedProperty.building_size.toLocaleString()} SF`}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('select-property')}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Change
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Template cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TEMPLATE_INFO.map((tmpl) => (
                <button
                  key={tmpl.type}
                  onClick={() => {
                    setSelectedTemplate(tmpl.type);
                  }}
                  className="text-left"
                >
                  <Card className={`h-full hover:border-primary-400 hover:shadow-md transition-all cursor-pointer ${
                    selectedTemplate === tmpl.type ? 'border-primary-500 ring-2 ring-primary-200' : ''
                  }`}>
                    <CardContent className="p-6 space-y-3">
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

            {/* Color Theme selector */}
            {selectedTemplate && (
              <>
                <h3 className="text-sm font-medium text-gray-700 mt-6">Color Theme</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {STYLE_INFO.map((s) => (
                    <button
                      key={s.style}
                      onClick={() => setSelectedStyle(s.style)}
                      className={`text-left p-4 border rounded-lg transition-all ${
                        selectedStyle === s.style
                          ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: s.style === 'apex' ? '#780014' : s.style === 'modern' ? '#19191C' : '#003366',
                            }}
                          />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: s.style === 'apex' ? '#B21F24' : s.style === 'modern' ? '#BE1E2D' : '#00809B',
                            }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.label}</p>
                          <p className="text-xs text-gray-500">{s.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <Button onClick={() => setStep('generate-content')}>
                    Continue with {TEMPLATE_INFO.find(t => t.type === selectedTemplate)?.label}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Generate Content */}
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
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('select-template')}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Change Template
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

        {/* Step 4: Export */}
        {step === 'export' && selectedProperty && selectedTemplate && (
          <div className="space-y-4">
            {/* Actions */}
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
                  <Button variant="outline" onClick={handleSaveRecord} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Record'}
                  </Button>
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
