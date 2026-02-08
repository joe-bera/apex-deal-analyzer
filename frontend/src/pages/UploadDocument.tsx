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

// Store file data immediately to prevent mobile browser issues where File blob expires
interface FileData {
  name: string;
  size: number;
  type: string;
  buffer: ArrayBuffer;
}

export default function UploadDocument() {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
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
    // Accept application/pdf or files with .pdf extension (some browsers report non-standard MIME types)
    const isPdf = file.type === 'application/pdf' ||
      file.type === 'application/x-pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return 'Please upload a PDF file';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum size is ${MAX_FILE_SIZE_DISPLAY}.`;
    }
    return null;
  };

  // Read file data immediately to prevent mobile browser File blob expiration
  const processFile = async (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return false;
    }

    try {
      // Read file data immediately - this prevents the mobile browser bug
      // where File blob data expires after some time
      const buffer = await selectedFile.arrayBuffer();

      if (buffer.byteLength === 0) {
        setError('File appears to be empty (0 bytes). Please select a valid PDF file.');
        return false;
      }

      setFileData({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        buffer,
      });
      setFile(selectedFile);
      setError('');
      console.log('[Upload] File processed:', selectedFile.name, 'size:', buffer.byteLength);
      return true;
    } catch (err) {
      console.error('[Upload] Error reading file:', err);
      setError('Failed to read file. Please try again.');
      return false;
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const success = await processFile(e.target.files[0]);
      if (!success) {
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileData) {
      setError('Please select a file');
      return;
    }

    if (documentType === 'comp' && !propertyId) {
      setError('Please select a property for this comparable');
      return;
    }

    // Double-check that we have valid file data
    if (fileData.buffer.byteLength === 0) {
      setError('File data is invalid. Please select the file again.');
      setFile(null);
      setFileData(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[Upload] Starting upload, documentType:', documentType, 'propertyId:', propertyId);
      console.log('[Upload] File data:', fileData.name, 'size:', fileData.size, 'buffer:', fileData.buffer.byteLength);

      // Upload document with property_id if it's a comp
      const result: any = await api.uploadDocumentWithBuffer(
        fileData,
        documentType === 'comp' ? propertyId : undefined,
        documentType
      );
      const documentId = result.document.id;
      console.log('[Upload] Document uploaded, id:', documentId);

      // Extract data from document
      console.log('[Upload] Starting extraction...');
      await api.extractDocument(documentId);
      console.log('[Upload] Extraction complete');

      if (documentType === 'comp' && propertyId) {
        // For comp documents, go back to the property page
        console.log('[Upload] Navigating to property:', propertyId);
        navigate(`/properties/${propertyId}`);
      } else {
        // For other documents, create property from extracted data
        console.log('[Upload] Creating property from document...');
        const propertyResult: any = await api.createPropertyFromDocument(documentId);
        console.log('[Upload] Property created:', propertyResult.property.id);
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
                {fileData && (
                  <p className="text-sm text-gray-900 font-medium mt-2">
                    Selected: {fileData.name} ({formatFileSize(fileData.buffer.byteLength)})
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!file}
              isLoading={loading}
              className="flex-1"
              size="lg"
            >
              {loading ? 'Processing...' : 'Upload & Extract Data'}
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
