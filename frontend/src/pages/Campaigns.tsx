import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import type { EmailCampaign, EmailRecipient, CampaignType, CampaignStatus, ContactType } from '../types';

type ViewMode = 'list' | 'form' | 'detail';

interface CampaignFormData {
  id?: string;
  name: string;
  campaign_type: CampaignType;
  subject: string;
  html_body: string;
  master_property_id: string;
}

const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  new_listing: 'New Listing',
  price_reduction: 'Price Reduction',
  just_closed: 'Just Closed',
  market_update: 'Market Update',
  custom: 'Custom',
};

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  owner: 'Owner',
  tenant: 'Tenant',
  buyer: 'Buyer',
  seller: 'Seller',
  broker: 'Broker',
  lender: 'Lender',
  attorney: 'Attorney',
  property_manager: 'Property Manager',
  investor: 'Investor',
  developer: 'Developer',
  appraiser: 'Appraiser',
  contractor: 'Contractor',
  other: 'Other',
};

const EMPTY_FORM: CampaignFormData = {
  name: '',
  campaign_type: 'custom',
  subject: '',
  html_body: '',
  master_property_id: '',
};

export default function Campaigns() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentStep, setCurrentStep] = useState(1);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CampaignFormData>(EMPTY_FORM);
  const [aiInstructions, setAiInstructions] = useState('');
  const [generatingContent, setGeneratingContent] = useState(false);
  const [selectedContactType, setSelectedContactType] = useState<ContactType>('buyer');
  const [tagInput, setTagInput] = useState('');
  const [addingRecipients, setAddingRecipients] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.listCampaigns();
      if (res.success) setCampaigns(res.campaigns || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetail = async (id: string) => {
    try {
      setLoading(true);
      const res = await api.getCampaign(id);
      if (res.success) {
        setSelectedCampaign(res.campaign);
        setRecipients(res.recipients || []);
        setViewMode('detail');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleNewCampaign = () => {
    setFormData(EMPTY_FORM);
    setRecipients([]);
    setCurrentStep(1);
    setError(null);
    setSendResult(null);
    setViewMode('form');
  };

  const handleEditCampaign = async (campaign: EmailCampaign) => {
    try {
      setLoading(true);
      const res = await api.getCampaign(campaign.id);
      if (res.success) {
        setFormData({
          id: campaign.id,
          name: campaign.name,
          campaign_type: campaign.campaign_type,
          subject: campaign.subject || '',
          html_body: campaign.html_body || '',
          master_property_id: campaign.master_property_id || '',
        });
        setRecipients(res.recipients || []);
        setCurrentStep(1);
        setError(null);
        setViewMode('form');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await api.deleteCampaign(id);
      await loadCampaigns();
    } catch (err: any) {
      setError(err.message || 'Failed to delete campaign');
    }
  };

  // Step navigation — saves to backend on each forward step
  const handleStepNext = async () => {
    try {
      setLoading(true);
      setError(null);

      if (currentStep === 1) {
        if (formData.id) {
          await api.updateCampaign(formData.id, {
            name: formData.name,
            campaign_type: formData.campaign_type,
            master_property_id: formData.master_property_id || undefined,
          });
        } else {
          const res = await api.createCampaign({
            name: formData.name,
            campaign_type: formData.campaign_type,
            master_property_id: formData.master_property_id || undefined,
          });
          if (res.success && res.campaign) {
            setFormData((prev) => ({ ...prev, id: res.campaign.id }));
          }
        }
        setCurrentStep(2);
      } else if (currentStep === 2) {
        if (formData.id) {
          await api.updateCampaign(formData.id, {
            subject: formData.subject,
            html_body: formData.html_body,
          });
        }
        setCurrentStep(3);
      } else if (currentStep === 3) {
        setCurrentStep(4);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContent = async () => {
    try {
      setGeneratingContent(true);
      setError(null);
      const res = await api.generateCampaignContent({
        campaign_type: formData.campaign_type,
        master_property_id: formData.master_property_id || undefined,
        custom_instructions: aiInstructions || undefined,
      });
      if (res.success && res.content) {
        setFormData((prev) => ({
          ...prev,
          subject: res.content.subject,
          html_body: res.content.body_html,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate content');
    } finally {
      setGeneratingContent(false);
    }
  };

  const reloadRecipients = async () => {
    if (!formData.id) return;
    const res = await api.getCampaign(formData.id);
    if (res.success) setRecipients(res.recipients || []);
  };

  const handleAddRecipientsByType = async () => {
    if (!formData.id) return;
    try {
      setAddingRecipients(true);
      setError(null);
      await api.addCampaignRecipients(formData.id, { contact_type: selectedContactType });
      await reloadRecipients();
    } catch (err: any) {
      setError(err.message || 'Failed to add recipients');
    } finally {
      setAddingRecipients(false);
    }
  };

  const handleAddRecipientsByTag = async () => {
    if (!formData.id || !tagInput.trim()) return;
    try {
      setAddingRecipients(true);
      setError(null);
      await api.addCampaignRecipients(formData.id, { tag: tagInput.trim() });
      setTagInput('');
      await reloadRecipients();
    } catch (err: any) {
      setError(err.message || 'Failed to add recipients');
    } finally {
      setAddingRecipients(false);
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    if (!formData.id) return;
    try {
      await api.removeCampaignRecipient(formData.id, recipientId);
      setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
    } catch (err: any) {
      setError(err.message || 'Failed to remove recipient');
    }
  };

  const handleSendCampaign = async () => {
    if (!formData.id) return;
    if (!window.confirm(`Send this campaign to ${recipients.length} recipient(s)?`)) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.sendCampaign(formData.id);
      if (res.success) {
        setSendResult({ sent: res.sent || 0, failed: res.failed || 0, skipped: res.skipped || 0, total: res.total || 0 });
        await loadCampaigns();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send campaign');
    } finally {
      setLoading(false);
    }
  };

  const goBackToList = () => {
    setViewMode('list');
    setSelectedCampaign(null);
    setRecipients([]);
    setFormData(EMPTY_FORM);
    setCurrentStep(1);
    setSendResult(null);
    setError(null);
  };

  // ========== Badge helpers ==========
  const statusBadge = (status: CampaignStatus | string) => {
    const cls =
      status === 'sent' ? 'bg-green-100 text-green-800'
      : status === 'sending' ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-800';
    return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{status}</span>;
  };

  const typeBadge = (t: CampaignType) => (
    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
      {CAMPAIGN_TYPE_LABELS[t]}
    </span>
  );

  // ========== Step indicator ==========
  const steps = ['Basics', 'Content', 'Recipients', 'Review & Send'];
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const active = currentStep === num;
        const done = currentStep > num;
        return (
          <div key={num} className="flex items-center">
            <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold ${
              active ? 'border-primary-600 bg-primary-600 text-white'
              : done ? 'border-primary-600 bg-primary-50 text-primary-600'
              : 'border-gray-300 text-gray-400'
            }`}>{num}</div>
            <span className={`ml-2 text-sm font-medium ${active || done ? 'text-primary-700' : 'text-gray-400'}`}>{label}</span>
            {idx < steps.length - 1 && <div className={`mx-4 h-0.5 w-12 ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );

  // ========== RENDER: Campaign List ==========
  const renderList = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-500 mt-1">Create and send email campaigns to your contacts</p>
        </div>
        <button onClick={handleNewCampaign} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          New Campaign
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No campaigns yet</h3>
            <p className="text-gray-500 mb-4">Create your first email campaign to reach your contacts</p>
            <button onClick={handleNewCampaign} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              Create Campaign
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4">{typeBadge(c.campaign_type)}</td>
                  <td className="px-6 py-4">{statusBadge(c.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.total_recipients}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.total_sent}/{c.total_recipients}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right text-sm">
                    {c.status === 'draft' ? (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => handleEditCampaign(c)} className="text-primary-600 hover:text-primary-800 font-medium">Edit</button>
                        <button onClick={() => handleDeleteCampaign(c.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                      </div>
                    ) : (
                      <button onClick={() => loadCampaignDetail(c.id)} className="text-primary-600 hover:text-primary-800 font-medium">View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  // ========== RENDER: Form ==========
  const renderForm = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <button onClick={goBackToList} className="text-sm text-gray-500 hover:text-gray-800 mb-6 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Campaigns
      </button>

      <StepIndicator />

      {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}

      {/* Step 1 — Basics */}
      {currentStep === 1 && (
        <div className="max-w-lg mx-auto space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="E.g., Q1 Industrial Listings" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
            <select value={formData.campaign_type} onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value as CampaignType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              {Object.entries(CAMPAIGN_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property ID <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={formData.master_property_id} onChange={(e) => setFormData({ ...formData, master_property_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="UUID of linked property" />
          </div>
          <div className="flex justify-end pt-4">
            <button onClick={handleStepNext} disabled={!formData.name || loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Content */}
      {currentStep === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                <input type="text" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Email subject" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Body (HTML)</label>
                <textarea value={formData.html_body} onChange={(e) => setFormData({ ...formData, html_body: e.target.value })} rows={14}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm" placeholder="<p>Your email content...</p>" />
              </div>
              <div className="border-t pt-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">Generate with AI</label>
                <textarea value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" placeholder="Optional custom instructions..." />
                <button onClick={handleGenerateContent} disabled={generatingContent}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {generatingContent ? 'Generating...' : 'Generate Content with AI'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[400px] overflow-auto text-sm">
                {formData.subject && (
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <span className="text-xs text-gray-500">Subject: </span>
                    <span className="font-medium">{formData.subject}</span>
                  </div>
                )}
                {formData.html_body ? (
                  <div dangerouslySetInnerHTML={{ __html: formData.html_body }} />
                ) : (
                  <p className="text-gray-400 italic">No content yet</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between pt-4 border-t">
            <button onClick={() => setCurrentStep(1)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Back</button>
            <button onClick={handleStepNext} disabled={!formData.subject || !formData.html_body || loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Recipients */}
      {currentStep === 3 && (
        <div className="space-y-5">
          <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 text-sm font-medium text-primary-800">
            Recipients: {recipients.length}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Add by Contact Type</label>
              <div className="flex gap-2">
                <select value={selectedContactType} onChange={(e) => setSelectedContactType(e.target.value as ContactType)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm">
                  {Object.entries(CONTACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={handleAddRecipientsByType} disabled={addingRecipients}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {addingRecipients ? '...' : 'Add'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Add by Tag</label>
              <div className="flex gap-2">
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" placeholder="Tag name..." />
                <button onClick={handleAddRecipientsByTag} disabled={addingRecipients || !tagInput.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {addingRecipients ? '...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recipients.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">No recipients added yet</td></tr>
                  ) : recipients.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{r.email}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleRemoveRecipient(r.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between pt-4 border-t">
            <button onClick={() => setCurrentStep(2)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Back</button>
            <button onClick={handleStepNext} disabled={recipients.length === 0}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">Next</button>
          </div>
        </div>
      )}

      {/* Step 4 — Review & Send */}
      {currentStep === 4 && (
        sendResult ? (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Campaign Sent!</h3>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div><div className="text-2xl font-bold text-green-600">{sendResult.sent}</div><div className="text-xs text-gray-600">Sent</div></div>
                <div><div className="text-2xl font-bold text-red-600">{sendResult.failed}</div><div className="text-xs text-gray-600">Failed</div></div>
                <div><div className="text-2xl font-bold text-amber-600">{sendResult.skipped}</div><div className="text-xs text-gray-600">Skipped</div></div>
                <div><div className="text-2xl font-bold text-gray-800">{sendResult.total}</div><div className="text-xs text-gray-600">Total</div></div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={goBackToList} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">Back to Campaigns</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Campaign Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Name</dt><dd className="font-medium text-gray-900">{formData.name}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd>{typeBadge(formData.campaign_type)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Recipients</dt><dd className="font-medium text-gray-900">{recipients.length}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Subject</dt><dd className="font-medium text-gray-900 text-right max-w-[60%] truncate">{formData.subject}</dd></div>
              </dl>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Preview</label>
              <div className="border border-gray-200 rounded-lg p-4 bg-white max-h-64 overflow-auto text-sm">
                <div dangerouslySetInnerHTML={{ __html: formData.html_body }} />
              </div>
            </div>
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setCurrentStep(3)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Back</button>
              <button onClick={handleSendCampaign} disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
                {loading ? 'Sending...' : 'Send Campaign'}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );

  // ========== RENDER: Detail (sent campaign) ==========
  const renderDetail = () => {
    if (!selectedCampaign) return null;
    const failed = recipients.filter((r) => r.status === 'failed').length;
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <button onClick={goBackToList} className="text-sm text-gray-500 hover:text-gray-800 mb-6 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Campaigns
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCampaign.name}</h2>
          <div className="flex gap-2">{statusBadge(selectedCampaign.status)} {typeBadge(selectedCampaign.campaign_type)}</div>
          {selectedCampaign.sent_at && <p className="text-sm text-gray-500 mt-2">Sent {new Date(selectedCampaign.sent_at).toLocaleString()}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4"><div className="text-2xl font-bold text-green-600">{selectedCampaign.total_sent}</div><div className="text-xs text-gray-600">Sent</div></div>
          <div className="bg-red-50 rounded-lg p-4"><div className="text-2xl font-bold text-red-600">{failed}</div><div className="text-xs text-gray-600">Failed</div></div>
          <div className="bg-gray-50 rounded-lg p-4"><div className="text-2xl font-bold text-gray-800">{selectedCampaign.total_recipients}</div><div className="text-xs text-gray-600">Total</div></div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Subject</h3>
          <p className="text-gray-700">{selectedCampaign.subject || '—'}</p>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Body</h3>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-64 overflow-auto text-sm">
            {selectedCampaign.html_body ? <div dangerouslySetInnerHTML={{ __html: selectedCampaign.html_body }} /> : <p className="text-gray-400">No content</p>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recipients ({recipients.length})</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{r.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-2">{statusBadge(r.status)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-sm text-red-600">{r.error_message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      {viewMode === 'list' && renderList()}
      {viewMode === 'form' && renderForm()}
      {viewMode === 'detail' && renderDetail()}
    </Layout>
  );
}
