import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Button, Card, CardHeader, CardTitle, CardContent } from './ui';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  onUploadComplete: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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

export default function UploadDocumentModal({
  isOpen,
  onClose,
  propertyId,
  onUploadComplete,
}: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [documentType, setDocumentType] = useState('offering_memorandum');
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (selectedFile: File) => {
    const isPdf =
      selectedFile.type === 'application/pdf' ||
      selectedFile.type === 'application/x-pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      setError('Please upload a PDF file');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File too large (${formatFileSize(selectedFile.size)}). Maximum size is 50MB.`);
      return;
    }

    setFile(selectedFile);
    setFileBuffer(null);
    setError('');
    setReading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      if (buffer.byteLength === 0) {
        setError('File appears to be empty. If it\'s in cloud storage, download it first.');
        setFile(null);
        setReading(false);
        return;
      }
      setFileBuffer(buffer);
    } catch {
      setError('Could not read the file. It may be stored in the cloud.');
      setFile(null);
    } finally {
      setReading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !fileBuffer) return;

    setLoading(true);
    setError('');

    try {
      const result: any = await api.uploadDocumentWithBuffer(
        { name: file.name, size: file.size, type: file.type, buffer: fileBuffer },
        propertyId,
        documentType
      );

      await api.extractDocument(result.document.id);

      onUploadComplete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const resetFile = () => {
    setFile(null);
    setFileBuffer(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upload Document</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={loading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                {documentTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* File Drop Zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : fileBuffer
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <div className="space-y-1 text-center">
                  {reading ? (
                    <>
                      <svg className="mx-auto h-10 w-10 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-sm text-gray-600 mt-2">Reading file...</p>
                    </>
                  ) : fileBuffer && file ? (
                    <>
                      <svg className="mx-auto h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-900 font-medium mt-2">
                        {file.name} ({formatFileSize(file.size)})
                      </p>
                      <button
                        type="button"
                        onClick={resetFile}
                        className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                      >
                        Choose a different file
                      </button>
                    </>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500">
                          <span>Upload a file</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF up to 50MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!fileBuffer || loading}
                isLoading={loading}
                className="flex-1"
              >
                {loading ? 'Processing...' : 'Upload & Extract'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
