import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '../components/ui';

export default function Settings() {
  const { user, updateUser } = useAuth();

  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [companyPhone, setCompanyPhone] = useState(user?.company_phone || '');
  const [companyEmail, setCompanyEmail] = useState(user?.company_email || '');
  const [companyAddress, setCompanyAddress] = useState(user?.company_address || '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result: any = await api.updateProfile({
        company_name: companyName || undefined,
        company_phone: companyPhone || undefined,
        company_email: companyEmail || undefined,
        company_address: companyAddress || undefined,
      });
      updateUser(result.user);
      setMessage('Profile saved successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5MB');
      return;
    }

    setUploadingLogo(true);
    setError('');
    setMessage('');

    try {
      // Step 1: Get signed upload URL
      const urlData = await api.getLogoUploadUrl(file.name, file.size);

      // Step 2: Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();
      const uploadResponse = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: fileBuffer,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload logo');
      }

      // Step 3: Update profile with logo URL
      const logoResult: any = await api.updateProfileLogo(urlData.storage_path);
      updateUser({ company_logo_url: logoResult.company_logo_url });
      setMessage('Logo uploaded successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your company branding for PDF exports</p>
        </div>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-green-500 hover:text-green-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Company Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Company Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Preview */}
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                {user?.company_logo_url ? (
                  <img
                    src={user.company_logo_url}
                    alt="Company logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload your company logo. It will appear on all PDF exports. PNG or JPG, max 5MB.
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    {uploadingLogo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {user?.company_logo_url ? 'Replace Logo' : 'Upload Logo'}
                      </>
                    )}
                  </span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Real Estate Services"
              />
              <Input
                label="Phone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="(909) 555-1234"
              />
              <Input
                label="Email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="info@apexrealestate.com"
              />
              <Input
                label="Address"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="123 Main St, Ontario, CA 91764"
              />
              <div className="pt-2">
                <Button type="submit" isLoading={saving} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>PDF Header Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
              <div className="flex items-center gap-3">
                {user?.company_logo_url ? (
                  <img
                    src={user.company_logo_url}
                    alt="Logo"
                    className="h-10 w-auto bg-white rounded p-1"
                  />
                ) : (
                  <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg">{companyName || 'APEX REAL ESTATE'}</p>
                  <p className="text-blue-100 text-xs">
                    {[companyPhone, companyEmail].filter(Boolean).join(' | ') || 'Commercial Real Estate Deal Analysis'}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              This branding will appear on Deal Analysis PDFs, Executive Summaries, and LOI documents.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
