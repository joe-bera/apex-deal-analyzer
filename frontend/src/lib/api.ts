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

  // Documents
  uploadDocument: async (file: File, propertyId?: string, documentType?: string) => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/login';
      throw new APIError(401, 'Please log in to upload documents.');
    }

    const formData = new FormData();
    formData.append('file', file);
    if (propertyId) formData.append('property_id', propertyId);
    if (documentType) formData.append('document_type', documentType);

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new APIError(401, 'Session expired. Please log in again.');
      }
      throw new APIError(response.status, data.error || 'Upload failed');
    }
    return data;
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
};
