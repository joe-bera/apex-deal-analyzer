const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle expired/invalid token - redirect to login
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new APIError(401, 'Session expired. Please log in again.');
    }
    throw new APIError(response.status, data.error || 'Request failed');
  }

  return data;
}

export const api = {
  // Auth
  signup: (email: string, password: string, fullName: string) =>
    request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getCurrentUser: () => request<{ user: any }>('/auth/me'),

  // Documents - Direct upload to Supabase (bypasses backend proxy issues)
  uploadDocument: async (file: File, propertyId?: string, documentType?: string) => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/login';
      throw new APIError(401, 'Please log in to upload documents.');
    }

    // Upload via FormData to multer endpoint (no buffer pre-read needed)
    const formData = new FormData();
    formData.append('file', file);
    if (documentType) formData.append('document_type', documentType);
    if (propertyId) formData.append('property_id', propertyId);

    console.log('[API] uploadDocument via FormData:', file.name, 'size:', file.size);

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type - browser sets it with boundary for FormData
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[API] Upload failed:', data);
      throw new APIError(response.status, data.error || 'Failed to upload document');
    }

    console.log('[API] Document uploaded successfully:', data.document?.id);
    return data;
  },

  uploadDocumentFromUrl: async (
    url: string,
    fileName?: string,
    propertyId?: string,
    documentType?: string
  ) => {
    return request('/documents/upload-from-url', {
      method: 'POST',
      body: JSON.stringify({
        url,
        file_name: fileName,
        property_id: propertyId,
        document_type: documentType,
      }),
    });
  },

  // Upload with pre-read buffer (prevents mobile browser File blob expiration)
  uploadDocumentWithBuffer: async (
    fileData: { name: string; size: number; type: string; buffer: ArrayBuffer },
    propertyId?: string,
    documentType?: string
  ) => {
    const token = localStorage.getItem('token');

    console.log('[API] uploadDocumentWithBuffer called, token exists:', !!token);
    console.log('[API] Buffer size:', fileData.buffer.byteLength);

    if (!token) {
      console.error('[API] No token found in localStorage');
      window.location.href = '/login';
      throw new APIError(401, 'Please log in to upload documents.');
    }

    // Step 1: Get signed upload URL from backend
    console.log('[API] Getting signed upload URL...');
    let uploadUrlResponse;
    try {
      uploadUrlResponse = await fetch(`${API_BASE}/documents/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_name: fileData.name,
          file_size: fileData.size,
        }),
      });
    } catch (networkError) {
      console.error('[API] Network error getting upload URL:', networkError);
      throw new APIError(0, 'Network error. Please check your internet connection and try again.');
    }

    const uploadUrlData = await uploadUrlResponse.json();
    if (!uploadUrlResponse.ok) {
      console.error('[API] Failed to get upload URL:', uploadUrlData);
      throw new APIError(uploadUrlResponse.status, uploadUrlData.error || 'Failed to prepare upload');
    }

    console.log('[API] Got signed URL, uploading buffer directly to Supabase Storage...');
    console.log('[API] Buffer byteLength:', fileData.buffer.byteLength);

    // Step 2: Upload buffer directly to Supabase Storage
    let storageResponse;
    try {
      storageResponse = await fetch(uploadUrlData.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': fileData.type || 'application/pdf',
        },
        body: fileData.buffer,
      });
    } catch (networkError) {
      console.error('[API] Network error uploading to storage:', networkError);
      throw new APIError(0, 'Failed to upload file. Please try again.');
    }

    console.log('[API] Storage upload response:', storageResponse.status, storageResponse.statusText);

    if (!storageResponse.ok) {
      const errorText = await storageResponse.text();
      console.error('[API] Storage upload failed:', storageResponse.status, errorText);
      throw new APIError(storageResponse.status, 'Failed to upload file to storage');
    }

    console.log('[API] File uploaded to storage, creating document record...');
    console.log('[API] Sending file_size:', fileData.size);

    // Step 3: Create document record in backend
    let createResponse;
    try {
      createResponse = await fetch(`${API_BASE}/documents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storage_path: uploadUrlData.storage_path,
          file_name: fileData.name,
          file_size: fileData.size,
          property_id: propertyId,
          document_type: documentType,
        }),
      });
    } catch (networkError) {
      console.error('[API] Network error creating document:', networkError);
      throw new APIError(0, 'File uploaded but failed to create record. Please try again.');
    }

    const createData = await createResponse.json();
    if (!createResponse.ok) {
      console.error('[API] Failed to create document:', createData);
      throw new APIError(createResponse.status, createData.error || 'Failed to create document record');
    }

    console.log('[API] Document created successfully:', createData.document?.id);
    return createData;
  },

  listDocuments: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/documents${query}`);
  },

  getDocument: (id: string) => request(`/documents/${id}`),

  extractDocument: (id: string) =>
    request(`/documents/${id}/extract`, { method: 'POST' }),

  // Properties
  createPropertyFromDocument: (documentId: string, overrides?: any) =>
    request(`/properties/from-document/${documentId}`, {
      method: 'POST',
      body: JSON.stringify({ overrides }),
    }),

  listProperties: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/properties${query}`);
  },

  getProperty: (id: string) => request(`/properties/${id}`),

  updateProperty: (id: string, updates: any) =>
    request(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteProperty: (id: string) =>
    request(`/properties/${id}`, { method: 'DELETE' }),

  // Comps
  getComps: (propertyId: string) =>
    request(`/properties/${propertyId}/comps`),

  addComp: (propertyId: string, compData: any) =>
    request(`/properties/${propertyId}/comps`, {
      method: 'POST',
      body: JSON.stringify(compData),
    }),

  updateComp: (compId: string, updates: any) =>
    request(`/comps/${compId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteComp: (compId: string) =>
    request(`/comps/${compId}`, { method: 'DELETE' }),

  // Profile / Branding
  updateProfile: (data: { company_name?: string; company_phone?: string; company_email?: string; company_address?: string }) =>
    request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getLogoUploadUrl: (fileName: string, fileSize: number) =>
    request<{ upload_url: string; storage_path: string }>('/auth/profile/logo-upload-url', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_size: fileSize }),
    }),

  updateProfileLogo: (storagePath: string) =>
    request<{ company_logo_url: string }>('/auth/profile/logo', {
      method: 'PATCH',
      body: JSON.stringify({ storage_path: storagePath }),
    }),

  // Valuation Analysis
  getValuation: (propertyId: string) =>
    request(`/properties/${propertyId}/valuation`),

  analyzeProperty: (propertyId: string) =>
    request(`/properties/${propertyId}/analyze`, { method: 'POST' }),

  // LOI Generation
  generateLOI: (propertyId: string, buyerInfo: any, offerParams: any, useAI = false) =>
    request(`/properties/${propertyId}/loi`, {
      method: 'POST',
      body: JSON.stringify({ buyer_info: buyerInfo, offer_params: offerParams, use_ai: useAI }),
    }),

  getLOIs: (propertyId: string) =>
    request(`/properties/${propertyId}/lois`),

  updateLOI: (loiId: string, updates: any) =>
    request(`/properties/lois/${loiId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Photos
  getPhotos: (propertyId: string) =>
    request(`/properties/${propertyId}/photos`),

  uploadPhoto: async (
    propertyId: string,
    file: File,
    photoType: string = 'exterior',
    caption?: string,
    isPrimary: boolean = false
  ) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new APIError(401, 'Please log in to upload photos.');
    }

    // Step 1: Get signed upload URL
    const uploadUrlResponse = await fetch(`${API_BASE}/properties/${propertyId}/photos/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        file_name: file.name,
        file_size: file.size,
      }),
    });

    const uploadUrlData = await uploadUrlResponse.json();
    if (!uploadUrlResponse.ok) {
      throw new APIError(uploadUrlResponse.status, uploadUrlData.error || 'Failed to prepare upload');
    }

    // Step 2: Upload file directly to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const storageResponse = await fetch(uploadUrlData.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
      body: fileBuffer,
    });

    if (!storageResponse.ok) {
      throw new APIError(storageResponse.status, 'Failed to upload photo to storage');
    }

    // Step 3: Create photo record
    const createResponse = await fetch(`${API_BASE}/properties/${propertyId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storage_path: uploadUrlData.storage_path,
        file_name: file.name,
        file_size: file.size,
        photo_type: photoType,
        caption,
        is_primary: isPrimary,
      }),
    });

    const createData = await createResponse.json();
    if (!createResponse.ok) {
      throw new APIError(createResponse.status, createData.error || 'Failed to create photo record');
    }

    return createData;
  },

  updatePhoto: (photoId: string, updates: { photo_type?: string; caption?: string; is_primary?: boolean }) =>
    request(`/photos/${photoId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deletePhoto: (photoId: string) =>
    request(`/photos/${photoId}`, { method: 'DELETE' }),

  setPrimaryPhoto: (photoId: string) =>
    request(`/photos/${photoId}/set-primary`, { method: 'POST' }),

  // Deal Analysis
  getDealAnalysis: (propertyId: string) =>
    request(`/properties/${propertyId}/analysis`),

  saveDealAnalysis: (propertyId: string, analysisData: any) =>
    request(`/properties/${propertyId}/analysis`, {
      method: 'PUT',
      body: JSON.stringify(analysisData),
    }),

  deleteDealAnalysis: (propertyId: string) =>
    request(`/properties/${propertyId}/analysis`, { method: 'DELETE' }),

  // =========================================================================
  // CRM: Companies
  // =========================================================================
  listCompanies: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/companies${query}`);
  },
  getCompany: (id: string) => request<any>(`/companies/${id}`),
  createCompany: (data: any) =>
    request<any>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: any) =>
    request<any>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCompany: (id: string) =>
    request<any>(`/companies/${id}`, { method: 'DELETE' }),

  // =========================================================================
  // CRM: Contacts
  // =========================================================================
  listContacts: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/contacts${query}`);
  },
  getContact: (id: string) => request<any>(`/contacts/${id}`),
  createContact: (data: any) =>
    request<any>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id: string, data: any) =>
    request<any>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContact: (id: string) =>
    request<any>(`/contacts/${id}`, { method: 'DELETE' }),
  linkContactProperty: (contactId: string, data: any) =>
    request<any>(`/contacts/${contactId}/properties`, { method: 'POST', body: JSON.stringify(data) }),
  unlinkContactProperty: (contactId: string, linkId: string) =>
    request<any>(`/contacts/${contactId}/properties/${linkId}`, { method: 'DELETE' }),

  // =========================================================================
  // CRM: Deals
  // =========================================================================
  listCrmDeals: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/crm-deals${query}`);
  },
  getCrmDeal: (id: string) => request<any>(`/crm-deals/${id}`),
  getCrmDealPipeline: () => request<any>('/crm-deals/pipeline'),
  getCrmDealAnalytics: () => request<any>('/crm-deals/analytics'),
  createCrmDeal: (data: any) =>
    request<any>('/crm-deals', { method: 'POST', body: JSON.stringify(data) }),
  updateCrmDeal: (id: string, data: any) =>
    request<any>(`/crm-deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateCrmDealStage: (id: string, stage: string, notes?: string) =>
    request<any>(`/crm-deals/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage, notes }) }),
  deleteCrmDeal: (id: string) =>
    request<any>(`/crm-deals/${id}`, { method: 'DELETE' }),
  addDealContact: (dealId: string, contactId: string, role: string) =>
    request<any>(`/crm-deals/${dealId}/contacts`, { method: 'POST', body: JSON.stringify({ contact_id: contactId, role }) }),
  removeDealContact: (dealId: string, dcId: string) =>
    request<any>(`/crm-deals/${dealId}/contacts/${dcId}`, { method: 'DELETE' }),

  // =========================================================================
  // CRM: Activities
  // =========================================================================
  listActivities: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/activities${query}`);
  },
  getUpcomingTasks: () => request<any>('/activities/upcoming-tasks'),
  createActivity: (data: any) =>
    request<any>('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: (id: string, data: any) =>
    request<any>(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  completeActivity: (id: string) =>
    request<any>(`/activities/${id}/complete`, { method: 'PATCH' }),
  deleteActivity: (id: string) =>
    request<any>(`/activities/${id}`, { method: 'DELETE' }),

  // =========================================================================
  // Document Generator (Phase 2)
  // =========================================================================
  generateDocContent: (masterPropertyId: string, contentTypes: string[]) =>
    request<any>('/generate/content', {
      method: 'POST',
      body: JSON.stringify({ master_property_id: masterPropertyId, content_types: contentTypes }),
    }),

  saveGeneratedDoc: (data: {
    master_property_id?: string;
    template_type: string;
    title: string;
    file_url?: string;
    content_snapshot?: Record<string, unknown>;
  }) =>
    request<any>('/generate/save', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listGeneratedDocs: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/generate/documents${query}`);
  },

  getGeneratedDoc: (id: string) => request<any>(`/generate/documents/${id}`),

  deleteGeneratedDoc: (id: string) =>
    request<any>(`/generate/documents/${id}`, { method: 'DELETE' }),

  // =========================================================================
  // Listing Sites (Phase 4)
  // =========================================================================
  createListingSite: (data: {
    master_property_id: string;
    custom_headline?: string;
    custom_description?: string;
    template_style?: string;
    lead_capture_email?: string;
    virtual_tour_url?: string;
    brochure_doc_id?: string;
    om_doc_id?: string;
  }) =>
    request<any>('/listing-sites', { method: 'POST', body: JSON.stringify(data) }),

  listListingSites: () => request<any>('/listing-sites'),

  getListingSite: (id: string) => request<any>(`/listing-sites/${id}`),

  updateListingSite: (id: string, data: Record<string, unknown>) =>
    request<any>(`/listing-sites/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteListingSite: (id: string) =>
    request<any>(`/listing-sites/${id}`, { method: 'DELETE' }),

  getListingLeads: (id: string) => request<any>(`/listing-sites/${id}/leads`),

  // Public listing endpoints (no auth header needed, but `request` adds it harmlessly)
  fetchPublicListing: (slug: string) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    return fetch(`${base}/public/listings/${slug}`).then(r => r.json());
  },

  submitListingLead: (slug: string, data: { name: string; email: string; phone?: string; company?: string; message?: string }) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    return fetch(`${base}/public/listings/${slug}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());
  },

  // =========================================================================
  // Prospecting Lists (Phase 5)
  // =========================================================================
  previewProspectFilter: (filters: Record<string, any>) =>
    request<any>('/prospect-lists/preview', {
      method: 'POST',
      body: JSON.stringify({ filters }),
    }),

  listProspectLists: () => request<any>('/prospect-lists'),

  getProspectList: (id: string) => request<any>(`/prospect-lists/${id}`),

  createProspectList: (data: { name: string; description?: string; filters: Record<string, any> }) =>
    request<any>('/prospect-lists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProspectList: (id: string, data: Record<string, any>) =>
    request<any>(`/prospect-lists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteProspectList: (id: string) =>
    request<any>(`/prospect-lists/${id}`, { method: 'DELETE' }),

  refreshProspectList: (id: string) =>
    request<any>(`/prospect-lists/${id}/refresh`, { method: 'POST' }),

  exportProspectListCSV: async (id: string) => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${base}/prospect-lists/${id}/export`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'prospect_list.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  updateProspectListItem: (listId: string, itemId: string, data: { status?: string; notes?: string }) =>
    request<any>(`/prospect-lists/${listId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkUpdateProspectListItems: (listId: string, data: { item_ids: string[]; status?: string; notes?: string }) =>
    request<any>(`/prospect-lists/${listId}/bulk-update`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // =========================================================================
  // Owner Research (Phase 6)
  // =========================================================================
  getOwnerResearch: (propertyId: string) =>
    request<any>(`/owner-research/${propertyId}`),

  runAIOwnerResearch: (propertyId: string) =>
    request<any>(`/owner-research/${propertyId}/ai`, { method: 'POST' }),

  createOwnerResearch: (propertyId: string, data: Record<string, any>) =>
    request<any>(`/owner-research/${propertyId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateOwnerResearch: (id: string, data: Record<string, any>) =>
    request<any>(`/owner-research/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteOwnerResearch: (id: string) =>
    request<any>(`/owner-research/${id}`, { method: 'DELETE' }),

  // =========================================================================
  // Email Campaigns (Phase 7)
  // =========================================================================
  listCampaigns: () => request<any>('/campaigns'),

  getCampaign: (id: string) => request<any>(`/campaigns/${id}`),

  createCampaign: (data: {
    name: string;
    campaign_type?: string;
    subject?: string;
    html_body?: string;
    master_property_id?: string;
  }) =>
    request<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),

  updateCampaign: (id: string, data: Record<string, any>) =>
    request<any>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCampaign: (id: string) =>
    request<any>(`/campaigns/${id}`, { method: 'DELETE' }),

  generateCampaignContent: (data: {
    campaign_type: string;
    master_property_id?: string;
    custom_instructions?: string;
  }) =>
    request<any>('/campaigns/generate-content', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addCampaignRecipients: (campaignId: string, data: {
    contact_ids?: string[];
    contact_type?: string;
    tag?: string;
  }) =>
    request<any>(`/campaigns/${campaignId}/recipients`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeCampaignRecipient: (campaignId: string, recipientId: string) =>
    request<any>(`/campaigns/${campaignId}/recipients/${recipientId}`, { method: 'DELETE' }),

  sendCampaign: (id: string) =>
    request<any>(`/campaigns/${id}/send`, { method: 'POST' }),

  // =========================================================================
  // Reports (Phase 8)
  // =========================================================================
  getReportPipelineForecast: () =>
    request<any>('/reports/pipeline-forecast'),

  getReportBrokerProduction: (params?: { start?: string; end?: string }) => {
    const query = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString() : '';
    return request<any>(`/reports/broker-production${query}`);
  },

  getReportRevenue: (params?: { start?: string; end?: string }) => {
    const query = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString() : '';
    return request<any>(`/reports/revenue${query}`);
  },

  getReportActivitySummary: (params?: { start?: string; end?: string }) => {
    const query = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString() : '';
    return request<any>(`/reports/activity-summary${query}`);
  },

  getReportPropertyAnalytics: () =>
    request<any>('/reports/property-analytics'),

  getReportProspecting: () =>
    request<any>('/reports/prospecting'),

  // =========================================================================
  // Deal Room (Phase 9)
  // =========================================================================
  getDealRoom: (dealId: string) =>
    request<any>(`/crm-deals/${dealId}/room`),

  getDealRoomUploadUrl: (dealId: string, fileName: string) =>
    request<any>(`/crm-deals/${dealId}/room/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName }),
    }),

  addDealRoomDocument: (dealId: string, data: {
    storage_path: string;
    file_name: string;
    file_size?: number;
    file_type?: string;
    category?: string;
    description?: string;
    is_visible_to_external?: boolean;
  }) =>
    request<any>(`/crm-deals/${dealId}/room/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteDealRoomDocument: (dealId: string, docId: string) =>
    request<any>(`/crm-deals/${dealId}/room/documents/${docId}`, { method: 'DELETE' }),

  createDealRoomInvite: (dealId: string, data: { email: string; name?: string; expires_in_days?: number }) =>
    request<any>(`/crm-deals/${dealId}/room/invites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revokeDealRoomInvite: (dealId: string, inviteId: string) =>
    request<any>(`/crm-deals/${dealId}/room/invites/${inviteId}`, { method: 'DELETE' }),

  getDealRoomActivity: (dealId: string) =>
    request<any>(`/crm-deals/${dealId}/room/activity`),

  // Public deal room (no auth)
  fetchPublicDealRoom: (token: string) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    return fetch(`${base}/deal-room/${token}`).then(r => r.json());
  },

  downloadPublicDealRoomFile: (token: string, docId: string) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    return fetch(`${base}/deal-room/${token}/download/${docId}`, { method: 'POST' }).then(r => r.json());
  },

  uploadDealRoomFile: async (dealId: string, file: File, category: string = 'other', description?: string) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Please log in');

    // Step 1: Get signed upload URL
    const base = import.meta.env.VITE_API_URL || '/api';
    const urlRes = await fetch(`${base}/crm-deals/${dealId}/room/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file_name: file.name }),
    });
    const urlData = await urlRes.json();
    if (!urlRes.ok) throw new Error(urlData.error || 'Failed to get upload URL');

    // Step 2: Upload to storage
    const fileBuffer = await file.arrayBuffer();
    const storageRes = await fetch(urlData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: fileBuffer,
    });
    if (!storageRes.ok) throw new Error('Failed to upload file');

    // Step 3: Create document record
    const createRes = await fetch(`${base}/crm-deals/${dealId}/room/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        storage_path: urlData.storage_path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        category,
        description,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || 'Failed to create document');
    return createData;
  },

  // =========================================================================
  // Playbooks (Phase 9)
  // =========================================================================
  listPlaybooks: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/playbooks${query}`);
  },

  getPlaybook: (id: string) => request<any>(`/playbooks/${id}`),

  createPlaybook: (data: { name: string; description?: string; deal_type?: string }) =>
    request<any>('/playbooks', { method: 'POST', body: JSON.stringify(data) }),

  updatePlaybook: (id: string, data: Record<string, any>) =>
    request<any>(`/playbooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deletePlaybook: (id: string) =>
    request<any>(`/playbooks/${id}`, { method: 'DELETE' }),

  addPlaybookTask: (playbookId: string, data: Record<string, any>) =>
    request<any>(`/playbooks/${playbookId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),

  updatePlaybookTask: (playbookId: string, taskId: string, data: Record<string, any>) =>
    request<any>(`/playbooks/${playbookId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deletePlaybookTask: (playbookId: string, taskId: string) =>
    request<any>(`/playbooks/${playbookId}/tasks/${taskId}`, { method: 'DELETE' }),

  // =========================================================================
  // Deal Tasks (Phase 9)
  // =========================================================================
  listDealTasks: (dealId: string) =>
    request<any>(`/crm-deals/${dealId}/tasks`),

  createDealTask: (dealId: string, data: Record<string, any>) =>
    request<any>(`/crm-deals/${dealId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),

  updateDealTask: (dealId: string, taskId: string, data: Record<string, any>) =>
    request<any>(`/crm-deals/${dealId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDealTask: (dealId: string, taskId: string) =>
    request<any>(`/crm-deals/${dealId}/tasks/${taskId}`, { method: 'DELETE' }),

  applyPlaybook: (dealId: string, playbookId: string) =>
    request<any>(`/crm-deals/${dealId}/apply-playbook`, {
      method: 'POST',
      body: JSON.stringify({ playbook_id: playbookId }),
    }),

  // =========================================================================
  // Syndication (Phase 10)
  // =========================================================================
  listSyndicationPlatforms: () =>
    request<any>('/syndication/platforms'),

  listSyndications: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/syndication${query}`);
  },

  getSyndication: (id: string) =>
    request<any>(`/syndication/${id}`),

  createSyndication: (data: { listing_site_id: string; platform_id: string }) =>
    request<any>('/syndication', { method: 'POST', body: JSON.stringify(data) }),

  publishSyndication: (id: string) =>
    request<any>(`/syndication/${id}/publish`, { method: 'POST' }),

  syncSyndication: (id: string) =>
    request<any>(`/syndication/${id}/sync`, { method: 'POST' }),

  delistSyndication: (id: string) =>
    request<any>(`/syndication/${id}/delist`, { method: 'POST' }),

  deleteSyndication: (id: string) =>
    request<any>(`/syndication/${id}`, { method: 'DELETE' }),

  generateSyndicationExport: (id: string, format: 'csv' | 'json' = 'csv') =>
    request<any>(`/syndication/${id}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    }),

  getSyndicationActivity: (id: string) =>
    request<any>(`/syndication/${id}/activity`),

  bulkPublishSyndication: (data: { listing_site_id: string; platform_ids: string[] }) =>
    request<any>('/syndication/bulk-publish', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  exportReportCSV: async (type: string, params?: { start?: string; end?: string }) => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_URL || '/api';
    const query = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString() : '';
    const response = await fetch(`${base}/reports/${type}/export${query}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `${type}_report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
