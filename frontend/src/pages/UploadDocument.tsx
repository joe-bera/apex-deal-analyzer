import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { Button } from '../components/ui';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE_DISPLAY = '50MB';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

type UploadMode = 'file' | 'url';

export default function UploadDocument() {
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [documentType, setDocumentType] = useState('offering_memorandum');
  const [propertyId, setPropertyId] = useState<string>('');
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Load properties for comp selection
    const loadProperties = async () => {
      try {
        const result: any = await api.listProperties();
        setProperties(result.properties || []);
      } catch (err) {
        console.error('Failed to load properties:', err);
      }
    };
    loadProperties();

    // Check if property_id is in URL params
    const propId = searchParams.get('property_id');
    if (propId) {
      setPropertyId(propId);
      setDocumentType('comp'); // Default to comp if coming from property page
    }
  }, [searchParams]);

  const documentTypes = [
    { value: 'offering_memorandum', label: 'Offering Memorandum' },
    { value: 'property_profile', label: 'Property Profile (CoStar, Crexi, etc.)' },
    { value: 'title_report', label: 'Title Report' },
    { value: 'comp', label: 'Comparable Sale' },
    { value: 'lease', label: 'Lease Agreement' },
    { value: 'appraisal', label: 'Appraisal' },
    { value: 'environmental_report', label: 'Environmental Report' },
    { value: 'other', label: 'Other' },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): string | null => {
    const isPdf = file.type === 'application/pdf' ||
      file.type === 'application/x-pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return 'Please upload a PDF file';
    }
    if (file.size === 0) {
      return 'This file appears to be 0 bytes. This usually happens when the file is stored in cloud storage (Dropbox, iCloud, OneDrive) and hasn\'t been downloaded locally. Try using the "From URL" tab instead — paste the Dropbox or Google Drive share link and we\'ll download it directly.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum size is ${MAX_FILE_SIZE_DISPLAY}.`;
    }
    return null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadMode === 'file' && !file) {
      setError('Please select a file');
      return;
    }

    if (uploadMode === 'url' && !fileUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (documentType === 'comp' && !propertyId) {
      setError('Please select a property for this comparable');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let documentId: string;

      if (uploadMode === 'url') {
        // Upload from URL (Dropbox, Google Drive, etc.)
        const result: any = await api.uploadDocumentFromUrl(
          fileUrl.trim(),
          fileName.trim() || undefined,
          documentType === 'comp' ? propertyId : undefined,
          documentType
        );
        documentId = result.document.id;
      } else {
        // Upload via FormData
        const result: any = await api.uploadDocument(
          file!,
          documentType === 'comp' ? propertyId : undefined,
          documentType
        );
        documentId = result.document.id;
      }

      // Extract data from document
      await api.extractDocument(documentId);

      if (documentType === 'comp' && propertyId) {
        navigate(`/properties/${propertyId}`);
      } else {
        const propertyResult: any = await api.createPropertyFromDocument(documentId);
        navigate(`/properties/${propertyResult.property.id}`);
      }
    } catch (err: any) {
      console.error('[Upload] Error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upload Document</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload a PDF document to automatically extract property data
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Upload Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => { setUploadMode('file'); setError(''); }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                uploadMode === 'file'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                From Computer
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setUploadMode('url'); setError(''); }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                uploadMode === 'url'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                From URL
              </span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {documentType === 'comp' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Property *
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Choose a property...</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.address || 'Vacant Land'}, {prop.city} - {prop.property_type}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                This comparable will be added to the selected property
              </p>
            </div>
          )}

          {/* File Upload (From Computer) */}
          {uploadMode === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF File</label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 bg-white'
                } transition-colors`}
              >
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF up to {MAX_FILE_SIZE_DISPLAY}</p>
                  {file && (
                    <p className="text-sm text-gray-900 font-medium mt-2">
                      Selected: {file.name} ({formatFileSize(file.size)})
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* URL Upload (From Dropbox / Google Drive) */}
          {uploadMode === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Share Link
                </label>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="Paste Dropbox or Google Drive share link..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Supports Dropbox, Google Drive, and direct PDF links. Make sure the link has sharing enabled.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. Property_Report.pdf"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={uploadMode === 'file' ? !file : !fileUrl.trim()}
              isLoading={loading}
              className="flex-1"
              size="lg"
            >
              {loading
                ? (uploadMode === 'url' ? 'Downloading & Processing...' : 'Processing...')
                : 'Upload & Extract Data'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
