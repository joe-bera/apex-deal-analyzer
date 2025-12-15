/**
 * Frontend TypeScript Types
 *
 * Shared type definitions for the Apex Deal Analyzer frontend.
 */

// ============================================================================
// Property Types
// ============================================================================

export type PropertyType =
  | 'warehouse'
  | 'distribution_center'
  | 'manufacturing'
  | 'flex_space'
  | 'cold_storage'
  | 'industrial'
  | 'office'
  | 'retail'
  | 'multifamily'
  | 'land'
  | 'mixed_use'
  | 'other';

export type PropertyStatus =
  | 'prospect'
  | 'contacted'
  | 'pitched'
  | 'listed'
  | 'under_contract'
  | 'sold'
  | 'dead'
  | 'watch';

export interface Property {
  id: string;
  created_by: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  apn?: string;
  property_type?: PropertyType;
  status?: PropertyStatus;
  subtype?: string;
  building_size?: number;
  lot_size?: number;
  year_built?: number;
  stories?: number;
  units?: number;
  price?: number;
  price_per_sqft?: number;
  cap_rate?: number;
  noi?: number;
  gross_income?: number;
  operating_expenses?: number;
  occupancy_rate?: number;
  market?: string;
  submarket?: string;
  zoning?: string;
  parking_spaces?: number;
  additional_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  documents?: Document[];
}

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType =
  | 'offering_memorandum'
  | 'title_report'
  | 'comp'
  | 'lease'
  | 'appraisal'
  | 'environmental_report'
  | 'other';

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  property_id?: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size: number;
  document_type: DocumentType;
  extraction_status: ExtractionStatus;
  extracted_data?: ExtractedData;
  uploaded_at: string;
}

export interface ExtractedData {
  raw_text?: string;
  structured_data?: Record<string, unknown>;
  confidence_scores?: Record<string, number>;
}

// ============================================================================
// Comp Types
// ============================================================================

export interface Comp {
  id: string;
  property_id: string;
  created_by: string;
  comp_address: string;
  comp_city: string;
  comp_state: string;
  comp_zip_code?: string;
  comp_property_type: PropertyType;
  comp_square_footage?: number;
  comp_year_built?: number;
  comp_sale_price: number;
  comp_sale_date: string;
  comp_price_per_sqft?: number;
  comp_cap_rate?: number;
  distance_miles?: number;
  similarity_score?: number;
  adjustment_notes?: string;
  source?: string;
  created_at: string;
}

export interface CreateCompInput {
  comp_address: string;
  comp_city: string;
  comp_state: string;
  comp_zip_code?: string;
  comp_property_type: PropertyType;
  comp_square_footage?: number | null;
  comp_year_built?: number | null;
  comp_sale_price: number;
  comp_sale_date: string;
  comp_price_per_sqft?: number | null;
  comp_cap_rate?: number | null;
  distance_miles?: number;
  similarity_score?: number;
  adjustment_notes?: string;
  source?: string;
}

// ============================================================================
// Valuation Types
// ============================================================================

export interface PricingScenario {
  price: number;
  price_per_sqft: number;
  timeline: string;
  rationale: string;
  discount_percentage?: number;
  premium_percentage?: number;
}

export interface WholesaleOffer {
  offer_price: number;
  arv_percentage: number;
  potential_profit: number;
  rationale: string;
}

export interface ValuationResult {
  estimated_value: number;
  value_range: {
    low: number;
    high: number;
  };
  confidence_level: 'High' | 'Medium' | 'Low';
  price_per_sqft_estimate?: number | null;
  analysis: string;
  comparable_analysis: ComparableAnalysis[];
  key_findings: string[];
  recommendations: string[];
  market_insights: string;
  pricing_scenarios?: {
    quick_sale: PricingScenario;
    market_sale: PricingScenario;
    premium_sale: PricingScenario;
  };
  wholesale_offer?: WholesaleOffer;
  executive_summary?: string;
}

export interface ComparableAnalysis {
  comp_id: string;
  comp_address: string;
  sale_price: number;
  adjustments: string;
  adjusted_value: number;
}

// ============================================================================
// LOI Types
// ============================================================================

export interface BuyerInfo {
  buyer_name: string;
  buyer_company?: string;
  buyer_address?: string;
  buyer_city?: string;
  buyer_state?: string;
  buyer_zip?: string;
  buyer_phone?: string;
  buyer_email?: string;
}

export interface LOIParams {
  offer_price: number;
  earnest_money?: number;
  due_diligence_days?: number;
  closing_days?: number;
  contingencies?: string[];
  special_terms?: string;
}

export interface LOI {
  id?: string;
  property_id: string;
  created_by?: string;
  buyer_name: string;
  buyer_company?: string;
  buyer_email?: string;
  offer_price: number;
  earnest_money: number;
  due_diligence_days: number;
  closing_days: number;
  contingencies: string[];
  loi_html: string;
  loi_text: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  generated_at: string;
  created_at?: string;
}

export interface LOIResponse {
  success: boolean;
  message: string;
  loi: LOI;
}

export interface LOIsResponse {
  success: boolean;
  lois: LOI[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  details?: string[];
  data?: T;
}

export interface PropertiesResponse {
  success: boolean;
  properties: Property[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface PropertyResponse {
  success: boolean;
  property: Property;
}

export interface CompsResponse {
  success: boolean;
  comps: Comp[];
}

export interface CompResponse {
  success: boolean;
  message: string;
  comp: Comp;
}

export interface ValuationResponse {
  success: boolean;
  message: string;
  valuation: ValuationResult;
  deal_id?: string;
}

export interface DocumentsResponse {
  success: boolean;
  documents: Document[];
}

export interface DocumentResponse {
  success: boolean;
  document: Document;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: 'admin' | 'broker' | 'analyst' | 'investor';
  organization?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  full_name?: string;
}
