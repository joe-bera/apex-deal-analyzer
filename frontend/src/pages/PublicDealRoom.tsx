import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { PublicDealRoomData } from '../types';

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PublicDealRoom() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicDealRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.fetchPublicDealRoom(token)
      .then((res) => {
        if (res.success) {
          setData(res);
        } else {
          setError(res.error || 'Deal room not found');
        }
      })
      .catch(() => setError('Failed to load deal room'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async (docId: string, fileName: string) => {
    if (!token) return;
    setDownloading(docId);
    try {
      const res = await api.downloadPublicDealRoomFile(token, docId);
      if (res.success && res.download_url) {
        const a = document.createElement('a');
        a.href = res.download_url;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Failed to download file');
      }
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#B21F24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#B21F24] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Deal Room</p>
              <h1 className="text-2xl font-bold text-gray-900">{data.deal_name}</h1>
            </div>
          </div>
          {data.invite_name && (
            <p className="text-sm text-gray-500">
              Welcome, <span className="font-medium text-gray-700">{data.invite_name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Documents ({data.documents.length})
        </h2>

        {!data.documents.length ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">No documents available yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.documents.map(doc => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#B21F24]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 uppercase">{doc.category}</span>
                      {doc.file_size && (
                        <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(doc.id, doc.file_name)}
                  disabled={downloading === doc.id}
                  className="ml-4 px-4 py-2 bg-[#B21F24] text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {downloading === doc.id ? 'Loading...' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#B21F24] rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-sm">Powered by Apex Deal Analyzer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
