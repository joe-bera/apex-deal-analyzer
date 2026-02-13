import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type {
  Property,
  Comp,
  ValuationResult,
  PropertyResponse,
  CompsResponse,
  ValuationResponse,
  CreateCompInput,
  PropertyType,
  PropertyStatus,
  LOI,
  LOIResponse,
  BuyerInfo,
  LOIParams,
  DealAnalysis,
  DealAnalysisResponse,
} from '../types';
import CompDetailModal from '../components/CompDetailModal';
import UploadDocumentModal from '../components/UploadDocumentModal';
import InvestmentAnalysis from '../components/InvestmentAnalysis';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  PropertyTypeBadge,
  StatsCard,
  Metric,
  Input,
  Select,
  EmptyState,
} from '../components/ui';
import { CompAnalysisCharts } from '../components/charts';
import PhotoGallery from '../components/PhotoGallery';
import { STATUS_OPTIONS } from '../components/StatusBadge';
import { generateExecutiveSummaryPDF, generateLOIPDF } from '../utils/pdfExport';
import { loadDefaultLogo } from '../utils/pdfBranding';

interface Photo {
  id: string;
  file_name: string;
  file_path: string;
  photo_type: string;
  caption?: string;
  is_primary: boolean;
  url: string;
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [addingComp, setAddingComp] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLOIForm, setShowLOIForm] = useState(false);
  const [generatingLOI, setGeneratingLOI] = useState(false);
  const [generatedLOI, setGeneratedLOI] = useState<LOI | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');

  // Multi-comp upload state
  const [uploadingComps, setUploadingComps] = useState(false);
  const [compUploadProgress, setCompUploadProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    results: { file: string; success: boolean; error?: string }[];
  } | null>(null);

  // Comp detail modal state
  const [selectedComp, setSelectedComp] = useState<Comp | null>(null);

  // Deal analysis state
  const [dealAnalysis, setDealAnalysis] = useState<DealAnalysis | null>(null);
  const [savingAnalysis, setSavingAnalysis] = useState(false);

  // Cached logo for PDF exports
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPropertyData();
    }
  }, [id]);

  // Pre-load white logo for PDF exports
  useEffect(() => {
    loadDefaultLogo(user?.company_logo_url).then(setLogoBase64);
  }, [user?.company_logo_url]);

  const loadPropertyData = async () => {
    try {
      setLoading(true);
      const [propData, compsData, photosData, analysisData, valuationData] = await Promise.all([
        api.getProperty(id!),
        api.getComps(id!).catch(() => ({ comps: [] })),
        api.getPhotos(id!).catch(() => ({ photos: [] })),
        api.getDealAnalysis(id!).catch(() => ({ analysis: null })),
        api.getValuation(id!).catch(() => ({ valuation: null })),
      ]);
      setProperty((propData as PropertyResponse).property);
      setComps((compsData as CompsResponse).comps || []);
      setPhotos((photosData as { photos: Photo[] }).photos || []);
      setDealAnalysis((analysisData as DealAnalysisResponse).analysis || null);
      const savedValuation = (valuationData as any)?.valuation;
      if (savedValuation) {
        setValuation(savedValuation);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load property';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async () => {
    try {
      const photosData = await api.getPhotos(id!);
      setPhotos((photosData as { photos: Photo[] }).photos || []);
    } catch (err) {
      console.error('Failed to load photos:', err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!property || updatingStatus) return;

    try {
      setUpdatingStatus(true);
      await api.updateProperty(id!, { status: newStatus });
      setProperty({ ...property, status: newStatus as PropertyStatus });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setError(message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAnalyze = async () => {
    if (comps.length === 0) {
      setError('Please add at least one comparable sale before running analysis.');
      return;
    }

    try {
      setAnalyzing(true);
      setError('');
      const result = await api.analyzeProperty(id!);
      setValuation((result as ValuationResponse).valuation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddComp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent double submission
    if (addingComp) return;

    setAddingComp(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    const compData: CreateCompInput = {
      comp_address: formData.get('address') as string,
      comp_city: formData.get('city') as string,
      comp_state: formData.get('state') as string,
      comp_zip_code: (formData.get('zip') as string) || undefined,
      comp_property_type: formData.get('type') as PropertyType,
      comp_square_footage: formData.get('sqft') ? parseInt(formData.get('sqft') as string) : null,
      comp_year_built: formData.get('year') ? parseInt(formData.get('year') as string) : null,
      comp_sale_price: parseFloat(formData.get('price') as string),
      comp_sale_date: formData.get('date') as string,
      comp_price_per_sqft: formData.get('pricesf') ? parseFloat(formData.get('pricesf') as string) : null,
    };

    try {
      await api.addComp(id!, compData);
      setShowAddComp(false);
      await loadPropertyData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add comp';
      setError(message);
    } finally {
      setAddingComp(false);
    }
  };

  const handleDeleteComp = async (compId: string) => {
    if (!window.confirm('Delete this comp?')) return;

    try {
      await api.deleteComp(compId);
      await loadPropertyData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete comp';
      setError(message);
    }
  };

  const handleDeleteProperty = async () => {
    if (!window.confirm('Delete this property? This action cannot be undone.')) return;

    try {
      await api.deleteProperty(id!);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete property';
      setError(message);
    }
  };

  const handleGenerateLOI = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (generatingLOI) return;

    setGeneratingLOI(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    const buyerInfo: BuyerInfo = {
      buyer_name: formData.get('buyer_name') as string,
      buyer_company: formData.get('buyer_company') as string || undefined,
      buyer_email: formData.get('buyer_email') as string || undefined,
      buyer_phone: formData.get('buyer_phone') as string || undefined,
    };

    const offerParams: LOIParams = {
      offer_price: parseFloat(formData.get('offer_price') as string),
      earnest_money: formData.get('earnest_money') ? parseFloat(formData.get('earnest_money') as string) : undefined,
      due_diligence_days: formData.get('due_diligence_days') ? parseInt(formData.get('due_diligence_days') as string) : 30,
      closing_days: formData.get('closing_days') ? parseInt(formData.get('closing_days') as string) : 45,
      special_terms: formData.get('special_terms') as string || undefined,
    };

    try {
      const result = await api.generateLOI(id!, buyerInfo, offerParams);
      setGeneratedLOI((result as LOIResponse).loi);
      setShowLOIForm(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate LOI';
      setError(message);
    } finally {
      setGeneratingLOI(false);
    }
  };

  const handleSaveDealAnalysis = async (analysisData: Partial<DealAnalysis>) => {
    try {
      setSavingAnalysis(true);
      const result = await api.saveDealAnalysis(id!, analysisData);
      setDealAnalysis((result as DealAnalysisResponse).analysis);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save analysis';
      setError(message);
    } finally {
      setSavingAnalysis(false);
    }
  };

  const handleCompUpdate = (updatedComp: Comp) => {
    setComps(prev => prev.map(c => c.id === updatedComp.id ? updatedComp : c));
  };

  const handlePrintLOI = () => {
    if (!generatedLOI) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatedLOI.loi_html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadLOIHTML = () => {
    if (!generatedLOI) return;
    const blob = new Blob([generatedLOI.loi_html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOI_${property?.address || 'property'}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadLOIPDF = () => {
    if (!generatedLOI || !property) return;
    const branding = user ? {
      company_name: user.company_name,
      company_logo_url: user.company_logo_url,
      company_phone: user.company_phone,
      company_email: user.company_email,
      company_address: user.company_address,
    } : undefined;
    generateLOIPDF({ property, loi: generatedLOI, branding, logoBase64 });
  };

  const handleDownloadExecSummaryPDF = () => {
    if (!valuation || !property) return;
    const branding = user ? {
      company_name: user.company_name,
      company_logo_url: user.company_logo_url,
      company_phone: user.company_phone,
      company_email: user.company_email,
      company_address: user.company_address,
    } : undefined;
    generateExecutiveSummaryPDF({ property, valuation, branding, logoBase64 });
  };

  // Handle multi-comp PDF upload
  const handleCompFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      setError('Please select PDF files only');
      return;
    }

    setUploadingComps(true);
    setError('');
    setCompUploadProgress({
      current: 0,
      total: pdfFiles.length,
      currentFile: '',
      results: [],
    });

    const results: { file: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setCompUploadProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentFile: file.name,
      } : null);

      try {
        // Read file buffer
        const buffer = await file.arrayBuffer();

        // Upload document with comp type
        const uploadResult: any = await api.uploadDocumentWithBuffer(
          { name: file.name, size: file.size, type: file.type, buffer },
          id,
          'comp'
        );

        // Extract data from document
        await api.extractDocument(uploadResult.document.id);

        results.push({ file: file.name, success: true });
      } catch (err: any) {
        console.error(`Failed to upload comp ${file.name}:`, err);
        results.push({ file: file.name, success: false, error: err.message });
      }

      setCompUploadProgress(prev => prev ? { ...prev, results: [...results] } : null);
    }

    // Reset file input
    e.target.value = '';

    // Refresh comps list
    await loadPropertyData();

    // Show results briefly then clear
    setTimeout(() => {
      setUploadingComps(false);
      setCompUploadProgress(null);
    }, 2000);
  };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value?: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading property details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!property) {
    return (
      <Layout>
        <EmptyState
          title="Property not found"
          description="The property you're looking for doesn't exist or may have been deleted."
          action={{
            label: 'Back to Portfolio',
            onClick: () => navigate('/dashboard'),
          }}
          icon={
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb & Header */}
        <div>
          <Breadcrumbs items={[
            { label: 'My Deals', href: '/dashboard' },
            { label: property.address || 'Property' },
          ]} />

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {property.property_type && (
                  <PropertyTypeBadge type={property.property_type} />
                )}
                {property.market && (
                  <Badge variant="default">{property.market}</Badge>
                )}
                {/* Status Badge with dropdown */}
                <div className="relative inline-block">
                  <select
                    value={property.status || 'prospect'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="appearance-none bg-transparent border-none cursor-pointer focus:outline-none focus:ring-0 pr-6"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {updatingStatus && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {property.address || 'Vacant Land'}
              </h1>
              <p className="text-gray-500 mt-1">
                {[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => setShowUploadModal(true)}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
              >
                Upload Document
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || comps.length === 0}
                isLoading={analyzing}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
              >
                {analyzing ? 'Analyzing...' : valuation ? 'Re-run AI Valuation' : 'Run AI Valuation'}
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="List Price"
            value={formatCurrency(property.price)}
            variant="highlight"
            icon={
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatsCard
            label="CAP Rate"
            value={property.cap_rate ? `${property.cap_rate}%` : '—'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <StatsCard
            label="Building Size"
            value={property.building_size ? `${formatNumber(property.building_size)} SF` : '—'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatsCard
            label="Price / SF"
            value={property.price_per_sqft ? `$${property.price_per_sqft}` : '—'}
            icon={
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        {/* Photo Gallery */}
        <Card>
          <CardContent className="pt-6">
            <PhotoGallery
              propertyId={id!}
              photos={photos}
              onPhotosChange={loadPhotos}
            />
          </CardContent>
        </Card>

        {/* Investment Analysis Engine */}
        {property && (
          <InvestmentAnalysis
            property={property}
            comps={comps}
            initialData={dealAnalysis || undefined}
            onSave={handleSaveDealAnalysis}
            saving={savingAnalysis}
            photoUrl={(photos.find(p => p.is_primary) || photos.find(p => p.photo_type === 'exterior') || photos[0])?.url}
          />
        )}

        {/* AI Valuation Results */}
        {valuation && (
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>AI Valuation Analysis</CardTitle>
                    <p className="text-sm text-gray-500">Powered by Claude AI</p>
                  </div>
                </div>
                <Badge variant={valuation.confidence_level === 'High' ? 'success' : valuation.confidence_level === 'Medium' ? 'warning' : 'default'} size="md">
                  {valuation.confidence_level} confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Estimated Value Hero - Enhanced */}
              <div className="bg-gradient-to-br from-primary-50 via-primary-100 to-blue-50 rounded-xl p-8 mb-8 text-center border border-primary-200 shadow-sm">
                <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-2">Estimated Market Value</p>
                <p className="text-5xl font-extrabold text-primary-900 mb-3">{formatCurrency(valuation.estimated_value)}</p>
                {valuation.value_range && (
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-primary-200 text-sm font-semibold text-primary-700 shadow-sm">
                      {formatCurrency(valuation.value_range.low)}
                    </span>
                    <span className="text-primary-400 font-medium">to</span>
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-primary-200 text-sm font-semibold text-primary-700 shadow-sm">
                      {formatCurrency(valuation.value_range.high)}
                    </span>
                  </div>
                )}
                {valuation.price_per_sqft_estimate && (
                  <p className="text-sm text-primary-500 mt-3">
                    Estimated ${valuation.price_per_sqft_estimate}/SF
                  </p>
                )}
              </div>

              <div className="space-y-8">
                {/* Analysis Text */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Analysis Summary</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{valuation.analysis}</p>
                </div>

                {/* Key Findings - Enhanced cards */}
                {valuation.key_findings && valuation.key_findings.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Key Findings</h3>
                    <div className="space-y-3">
                      {valuation.key_findings.map((finding, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <div className="flex-shrink-0 w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </div>
                          <span className="text-gray-700 leading-relaxed">{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations - Enhanced cards */}
                {valuation.recommendations && valuation.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Recommendations</h3>
                    <div className="space-y-3">
                      {valuation.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 bg-green-50 rounded-lg p-4 border border-green-100">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-700 leading-relaxed">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {valuation.market_insights && (
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-2">Market Insights</h3>
                    <p className="text-gray-700 leading-relaxed">{valuation.market_insights}</p>
                  </div>
                )}

                {/* Pricing Scenarios - Enhanced */}
                {valuation.pricing_scenarios && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-5">Exit Strategy Pricing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Quick Sale */}
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="font-semibold text-orange-900">Quick Sale</span>
                        </div>
                        <p className="text-3xl font-bold text-orange-900 mb-1">{formatCurrency(valuation.pricing_scenarios.quick_sale.price)}</p>
                        <p className="text-sm text-orange-700 font-medium">${valuation.pricing_scenarios.quick_sale.price_per_sqft}/SF</p>
                        <div className="border-t border-orange-200 mt-3 pt-3">
                          <p className="text-xs text-orange-600 font-medium">{valuation.pricing_scenarios.quick_sale.timeline}</p>
                          <p className="text-xs text-orange-600">{valuation.pricing_scenarios.quick_sale.discount_percentage}% below market</p>
                          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{valuation.pricing_scenarios.quick_sale.rationale}</p>
                        </div>
                      </div>

                      {/* Market Sale */}
                      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5 shadow-md ring-1 ring-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span className="font-semibold text-blue-900">Market Sale</span>
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Recommended</span>
                        </div>
                        <p className="text-3xl font-bold text-blue-900 mb-1">{formatCurrency(valuation.pricing_scenarios.market_sale.price)}</p>
                        <p className="text-sm text-blue-700 font-medium">${valuation.pricing_scenarios.market_sale.price_per_sqft}/SF</p>
                        <div className="border-t border-blue-200 mt-3 pt-3">
                          <p className="text-xs text-blue-600 font-medium">{valuation.pricing_scenarios.market_sale.timeline}</p>
                          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{valuation.pricing_scenarios.market_sale.rationale}</p>
                        </div>
                      </div>

                      {/* Premium Sale */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span className="font-semibold text-green-900">Premium Sale</span>
                        </div>
                        <p className="text-3xl font-bold text-green-900 mb-1">{formatCurrency(valuation.pricing_scenarios.premium_sale.price)}</p>
                        <p className="text-sm text-green-700 font-medium">${valuation.pricing_scenarios.premium_sale.price_per_sqft}/SF</p>
                        <div className="border-t border-green-200 mt-3 pt-3">
                          <p className="text-xs text-green-600 font-medium">{valuation.pricing_scenarios.premium_sale.timeline}</p>
                          <p className="text-xs text-green-600">+{valuation.pricing_scenarios.premium_sale.premium_percentage}% above market</p>
                          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{valuation.pricing_scenarios.premium_sale.rationale}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Wholesale Offer */}
                {valuation.wholesale_offer && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-semibold text-purple-900">Investor/Wholesale Offer ({valuation.wholesale_offer.arv_percentage}% ARV)</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowLOIForm(true)}
                        leftIcon={
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        }
                      >
                        Generate LOI
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-purple-700">Offer Price</p>
                        <p className="text-3xl font-bold text-purple-900">{formatCurrency(valuation.wholesale_offer.offer_price)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-purple-700">Potential Profit</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(valuation.wholesale_offer.potential_profit)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-3">{valuation.wholesale_offer.rationale}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Executive Summary - Separate Card */}
        {valuation?.executive_summary && (
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>Executive Summary</CardTitle>
                    <p className="text-sm text-gray-500">AI-generated investment brief</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExecSummaryPDF}
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                >
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{valuation.executive_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* LOI Generation Form Modal */}
        {showLOIForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generate Letter of Intent</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowLOIForm(false)}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateLOI} className="space-y-4">
                  <div className="border-b pb-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">Buyer Information</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="buyer_name" required label="Your Name *" placeholder="John Smith" />
                      <Input name="buyer_company" label="Company" placeholder="ABC Investments LLC" />
                      <Input name="buyer_email" type="email" label="Email" placeholder="john@example.com" />
                      <Input name="buyer_phone" label="Phone" placeholder="(555) 123-4567" />
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Offer Terms</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        name="offer_price"
                        type="number"
                        required
                        label="Offer Price *"
                        leftAddon="$"
                        defaultValue={valuation?.wholesale_offer?.offer_price}
                      />
                      <Input
                        name="earnest_money"
                        type="number"
                        label="Earnest Money"
                        leftAddon="$"
                        placeholder="1% of offer"
                      />
                      <Input
                        name="due_diligence_days"
                        type="number"
                        label="Due Diligence (days)"
                        defaultValue={30}
                      />
                      <Input
                        name="closing_days"
                        type="number"
                        label="Closing (days)"
                        defaultValue={45}
                      />
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Special Terms</label>
                      <textarea
                        name="special_terms"
                        rows={3}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="Any special terms or conditions..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setShowLOIForm(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={generatingLOI} disabled={generatingLOI} className="flex-1">
                      {generatingLOI ? 'Generating...' : 'Generate LOI'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Generated LOI Display */}
        {generatedLOI && (
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle>Letter of Intent Generated</CardTitle>
                    <p className="text-sm text-gray-500">Offer: {formatCurrency(generatedLOI.offer_price)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadLOIPDF}>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrintLOI}>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadLOIHTML}>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    HTML
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setGeneratedLOI(null)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{generatedLOI.loi_text}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comp Analysis Charts */}
        {property && comps.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Comp Analysis Visualizations
            </h2>
            <CompAnalysisCharts property={property} comps={comps} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Comparable Sales - Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>Comparable Sales</CardTitle>
                    <Badge variant="primary">{comps.length}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {/* Hidden file input for multi-comp upload */}
                    <input
                      type="file"
                      id="comp-files-input"
                      accept=".pdf"
                      multiple
                      onChange={handleCompFilesSelect}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('comp-files-input')?.click()}
                      disabled={uploadingComps}
                      leftIcon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      }
                    >
                      Upload
                    </Button>
                    <Button
                      variant={showAddComp ? 'ghost' : 'outline'}
                      size="sm"
                      onClick={() => setShowAddComp(!showAddComp)}
                    >
                      {showAddComp ? 'Cancel' : '+ Add Comp'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload Progress */}
                {uploadingComps && compUploadProgress && (
                  <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      <span className="font-medium text-primary-900">
                        Uploading comp {compUploadProgress.current} of {compUploadProgress.total}
                      </span>
                    </div>
                    {compUploadProgress.currentFile && (
                      <p className="text-sm text-primary-700 mb-2">
                        Processing: {compUploadProgress.currentFile}
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="w-full bg-primary-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(compUploadProgress.current / compUploadProgress.total) * 100}%` }}
                      />
                    </div>
                    {/* Results */}
                    {compUploadProgress.results.length > 0 && (
                      <div className="space-y-1">
                        {compUploadProgress.results.map((result, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {result.success ? (
                              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                              {result.file}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Add Comp Form */}
                {showAddComp && (
                  <form onSubmit={handleAddComp} className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4">Add Comparable Sale</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input name="address" required placeholder="Address" label="Address *" />
                      <Input name="city" required placeholder="City" label="City *" />
                      <Input name="state" required placeholder="CA" maxLength={2} label="State *" />
                      <Input name="zip" placeholder="Zip Code" label="Zip Code" />
                      <Select
                        name="type"
                        label="Property Type *"
                        options={[
                          { value: 'warehouse', label: 'Warehouse' },
                          { value: 'distribution_center', label: 'Distribution Center' },
                          { value: 'manufacturing', label: 'Manufacturing' },
                          { value: 'flex_space', label: 'Flex Space' },
                          { value: 'land', label: 'Land' },
                          { value: 'office', label: 'Office' },
                          { value: 'retail', label: 'Retail' },
                          { value: 'industrial', label: 'Industrial' },
                        ]}
                        placeholder="Select type"
                      />
                      <Input name="sqft" type="number" placeholder="Square Feet" label="Square Feet" />
                      <Input name="year" type="number" placeholder="2020" label="Year Built" />
                      <Input name="price" type="number" step="0.01" required placeholder="Sale Price" label="Sale Price *" leftAddon="$" />
                      <Input name="date" type="date" required label="Sale Date *" />
                      <Input name="pricesf" type="number" step="0.01" placeholder="Price/SF" label="Price per SF" leftAddon="$" />
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={() => setShowAddComp(false)} disabled={addingComp}>
                        Cancel
                      </Button>
                      <Button type="submit" isLoading={addingComp} disabled={addingComp}>
                        {addingComp ? 'Adding...' : 'Add Comparable'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Comps List */}
                {comps.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="mx-auto w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-gray-900 font-medium mb-1">No comparable sales yet</h3>
                    <p className="text-gray-500 text-sm mb-4">Add comps to enable AI valuation analysis</p>
                    <Button size="sm" variant="outline" onClick={() => setShowAddComp(true)}>
                      + Add Your First Comp
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comps.map((comp) => (
                      <div
                        key={comp.id}
                        className="border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => setSelectedComp(comp)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">{comp.comp_address}</h4>
                              {comp.comp_property_type && (
                                <PropertyTypeBadge type={comp.comp_property_type} />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mb-3">
                              {comp.comp_city}, {comp.comp_state} {comp.comp_zip_code}
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <Metric label="Sale Price" value={comp.comp_sale_price} format="currency" size="sm" />
                              <Metric label="Sale Date" value={new Date(comp.comp_sale_date).toLocaleDateString()} size="sm" />
                              {comp.comp_square_footage && (
                                <Metric label="Size" value={`${formatNumber(comp.comp_square_footage)} SF`} size="sm" />
                              )}
                              {comp.comp_price_per_sqft && (
                                <Metric label="Price/SF" value={`$${comp.comp_price_per_sqft}`} size="sm" />
                              )}
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComp(comp);
                              }}
                              className="text-gray-500 hover:text-primary-600 hover:bg-primary-50"
                              title="View details"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteComp(comp.id);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete comp"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property Details */}
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  {property.apn && (
                    <Metric label="APN" value={property.apn} />
                  )}
                  {property.building_size && (
                    <Metric label="Building Size" value={property.building_size} format="number" />
                  )}
                  {property.lot_size && (
                    <Metric label="Lot Size" value={`${property.lot_size} acres`} />
                  )}
                  {property.year_built && (
                    <Metric label="Year Built" value={property.year_built} />
                  )}
                  {property.noi && (
                    <Metric label="NOI" value={property.noi} format="currency" />
                  )}
                  {property.submarket && (
                    <Metric label="Submarket" value={property.submarket} />
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Permanently delete this property and all associated data.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteProperty}
                  className="w-full"
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  }
                >
                  Delete Property
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Comp Detail Modal */}
      {selectedComp && (
        <CompDetailModal
          comp={selectedComp}
          subjectProperty={property}
          isOpen={!!selectedComp}
          onClose={() => setSelectedComp(null)}
          onUpdate={handleCompUpdate}
        />
      )}

      {/* Upload Document Modal */}
      <UploadDocumentModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        propertyId={id!}
        onUploadComplete={loadPropertyData}
      />
    </Layout>
  );
}
