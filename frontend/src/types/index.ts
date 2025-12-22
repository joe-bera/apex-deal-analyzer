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
  is_archived?: boolean;
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

// ============================================================================
// Deal Analysis Types
// ============================================================================

export interface DealAnalysis {
  id: string;
  property_id: string;
  created_by: string;

  // Income Analysis
  potential_gross_income?: number | null;
  vacancy_rate?: number | null;
  vacancy_amount?: number | null;
  other_income?: number | null;
  effective_gross_income?: number | null;

  // Expense Analysis
  property_taxes?: number | null;
  insurance?: number | null;
  utilities?: number | null;
  management_fee_percent?: number | null;
  management_fee_amount?: number | null;
  repairs_maintenance?: number | null;
  reserves_capex?: number | null;
  other_expenses?: number | null;
  total_operating_expenses?: number | null;
  operating_expense_ratio?: number | null;

  // Calculated Values
  net_operating_income?: number | null;
  cap_rate?: number | null;
  price_per_sqft?: number | null;
  grm?: number | null;

  // Financing
  purchase_price?: number | null;
  loan_amount?: number | null;
  ltv_percent?: number | null;
  interest_rate?: number | null;
  amortization_years?: number | null;
  loan_term_years?: number | null;
  monthly_payment?: number | null;
  annual_debt_service?: number | null;
  dscr?: number | null;

  // Cash Flow
  down_payment?: number | null;
  closing_costs_percent?: number | null;
  closing_costs?: number | null;
  total_cash_required?: number | null;
  before_tax_cash_flow?: number | null;
  cash_on_cash_return?: number | null;

  // Notes
  notes?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export type DealAnalysisInput = Omit<DealAnalysis, 'id' | 'property_id' | 'created_by' | 'created_at' | 'updated_at'>;

export interface DealAnalysisResponse {
  success: boolean;
  analysis: DealAnalysis | null;
  message?: string;
}

// ============================================================================
// Master Properties & Transactions Types (New Database Model)
// ============================================================================

export type MasterPropertyType =
  | 'industrial'
  | 'retail'
  | 'office'
  | 'multifamily'
  | 'land'
  | 'residential'
  | 'special_purpose';

export type PropertySubtype =
  // Industrial
  | 'warehouse'
  | 'distribution'
  | 'manufacturing'
  | 'flex'
  | 'cold_storage'
  | 'truck_terminal'
  // Retail
  | 'strip_center'
  | 'standalone_retail'
  | 'restaurant'
  | 'auto_service'
  | 'shopping_mall'
  // Office
  | 'office_class_a'
  | 'office_class_b'
  | 'office_class_c'
  | 'medical_office'
  | 'creative_office'
  // Multifamily
  | 'apartments'
  | 'condos'
  | 'townhomes'
  | 'senior_living'
  // Land
  | 'land_industrial'
  | 'land_commercial'
  | 'land_residential'
  | 'land_agricultural'
  | 'land_mixed_use'
  // Residential
  | 'single_family'
  | 'townhouse'
  | 'mobile_home'
  // Special Purpose
  | 'self_storage'
  | 'hospitality'
  | 'religious'
  | 'school'
  | 'other';

export type TransactionType = 'sale' | 'lease' | 'listing' | 'off_market';

export type DataSource =
  | 'costar'
  | 'crexi'
  | 'loopnet'
  | 'manual'
  | 'pdf_extract'
  | 'mls'
  | 'public_records'
  | 'other';

export interface MasterProperty {
  id: string;

  // Basic Info
  address: string;
  address_normalized?: string;
  property_name?: string;
  building_park?: string;

  // Location
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  submarket?: string;

  // Classification
  property_type?: MasterPropertyType;
  property_subtype?: PropertySubtype;
  building_status?: string;
  building_class?: string;
  zoning?: string;

  // Size
  building_size?: number;
  land_area_sf?: number;
  lot_size_acres?: number;

  // Building Details
  year_built?: number;
  year_renovated?: number;
  number_of_floors?: number;
  number_of_units?: number;

  // Industrial Specific
  clear_height_ft?: number;
  dock_doors?: number;
  grade_doors?: number;
  rail_served?: boolean;
  sprinkler_type?: string;
  power_amps?: number;
  office_percentage?: number;

  // Retail Specific
  frontage_ft?: number;
  parking_spaces?: number;
  parking_ratio?: number;
  anchor_tenant?: string;

  // Current Status
  percent_leased?: number;

  // Contacts
  owner_name?: string;
  owner_contact?: string;
  owner_address?: string;
  property_manager_name?: string;
  property_manager_phone?: string;
  leasing_company_name?: string;
  leasing_company_phone?: string;
  leasing_company_contact?: string;
  developer_name?: string;
  architect_name?: string;

  // External IDs
  costar_id?: string;
  crexi_id?: string;
  external_ids?: Record<string, string>;

  // Data Quality
  source?: DataSource;
  raw_import_data?: Record<string, unknown>;
  verified_at?: string;
  verification_reminder_at?: string;
  notes?: string;

  // Ownership
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;

  // Joined data (from views)
  latest_transaction_type?: TransactionType;
  latest_transaction_date?: string;
  latest_sale_price?: number;
  latest_price_per_sf?: number;
  latest_cap_rate?: number;

  // Related data
  transactions?: Transaction[];
}

export interface Transaction {
  id: string;
  property_id: string;

  // Transaction Details
  transaction_type: TransactionType;
  transaction_date?: string;
  recording_date?: string;

  // Sale Info
  sale_price?: number;
  price_per_sf?: number;
  cap_rate?: number;
  noi?: number;

  // Lease Info
  tenant_name?: string;
  lease_term_months?: number;
  rent_per_sf_year?: number;
  lease_type?: string;
  lease_start_date?: string;
  lease_end_date?: string;

  // Parties
  buyer_name?: string;
  seller_name?: string;
  broker_name?: string;
  broker_company?: string;

  // Listing Info
  asking_price?: number;
  asking_price_per_sf?: number;
  days_on_market?: number;
  listing_status?: string;

  // Data Quality
  source?: DataSource;
  source_document_url?: string;
  raw_import_data?: Record<string, unknown>;
  notes?: string;

  // Ownership
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Bulk Import Types
// ============================================================================

export interface ColumnMapping {
  csvColumn: string;
  dbField: string | null;
  sampleValues: string[];
}

export interface ImportPreview {
  totalRows: number;
  newProperties: number;
  existingProperties: number;
  newTransactions: number;
  duplicates: DuplicateMatch[];
  errors: ImportError[];
  previewRows: Record<string, unknown>[];
}

export interface DuplicateMatch {
  csvRow: number;
  csvAddress: string;
  existingProperty: MasterProperty;
  matchType: 'exact' | 'fuzzy';
  action: 'skip' | 'merge' | 'create_new';
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  error: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  source: DataSource;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  column_mapping: ColumnMapping[];
  errors?: ImportError[];
  created_by: string;
  created_at: string;
  completed_at?: string;
}

export interface ImportResult {
  success: boolean;
  batch_id: string;
  imported: number;
  skipped: number;
  errors: number;
  properties_created: string[];
  transactions_created: string[];
  error_details?: ImportError[];
}

// ============================================================================
// API Response Types for New Model
// ============================================================================

export interface MasterPropertiesResponse {
  success: boolean;
  properties: MasterProperty[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface MasterPropertyResponse {
  success: boolean;
  property: MasterProperty;
  transactions?: Transaction[];
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
}

export interface ImportPreviewResponse {
  success: boolean;
  preview: ImportPreview;
}

export interface ImportResultResponse {
  success: boolean;
  result: ImportResult;
}
