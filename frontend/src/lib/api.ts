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

    console.log('[API] uploadDocument called, token exists:', !!token);

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
          file_name: file.name,
          file_size: file.size,
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

    console.log('[API] Got signed URL, uploading directly to Supabase Storage...');

    // Step 2: Upload file directly to Supabase Storage
    let storageResponse;
    try {
      storageResponse = await fetch(uploadUrlData.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: file,
      });
    } catch (networkError) {
      console.error('[API] Network error uploading to storage:', networkError);
      throw new APIError(0, 'Failed to upload file. Please try again.');
    }

    if (!storageResponse.ok) {
      console.error('[API] Storage upload failed:', storageResponse.status);
      throw new APIError(storageResponse.status, 'Failed to upload file to storage');
    }

    console.log('[API] File uploaded to storage, creating document record...');

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
          file_name: file.name,
          file_size: file.size,
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

  // Valuation Analysis
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
};
