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
    console.log('[API] File details:', { name: file.name, size: file.size, type: file.type });

    // Step 2: Upload file directly to Supabase Storage
    // Read file as ArrayBuffer for reliable upload
    const fileBuffer = await file.arrayBuffer();
    console.log('[API] File buffer size:', fileBuffer.byteLength);

    let storageResponse;
    try {
      storageResponse = await fetch(uploadUrlData.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/pdf',
        },
        body: fileBuffer,
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
    console.log('[API] Sending file_size:', file.size);

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
};
