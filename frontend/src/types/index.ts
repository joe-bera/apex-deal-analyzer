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
  company_name?: string;
  company_logo_url?: string;
  company_phone?: string;
  company_email?: string;
  company_address?: string;
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

  // Strategy
  investment_strategy?: string | null;

  // Value-Add Attribution
  va_below_market_rents?: boolean | null;
  va_below_market_rents_note?: string | null;
  va_vacancy_leaseup?: boolean | null;
  va_vacancy_leaseup_note?: string | null;
  va_expense_reduction?: boolean | null;
  va_expense_reduction_note?: string | null;
  va_re_tenanting?: boolean | null;
  va_re_tenanting_note?: string | null;
  va_physical_improvements?: boolean | null;
  va_physical_improvements_note?: string | null;

  // As-Is vs Stabilized
  as_is_rent_psf?: number | null;
  stabilized_rent_psf?: number | null;
  as_is_occupancy?: number | null;
  stabilized_occupancy?: number | null;
  as_is_other_income?: number | null;
  stabilized_other_income?: number | null;
  as_is_expense_ratio?: number | null;
  stabilized_expense_ratio?: number | null;

  // Value-Add Costs
  va_capex?: number | null;
  va_ti_leasing?: number | null;
  va_carry_costs?: number | null;
  va_contingency?: number | null;
  va_total_cost?: number | null;

  // Proforma Settings
  income_growth_rate?: number | null;
  expense_growth_rate?: number | null;
  holding_period?: number | null;

  // Exit Analysis
  exit_cap_rate?: number | null;
  selling_costs_percent?: number | null;

  // Return Metrics
  irr?: number | null;
  equity_multiple?: number | null;
  avg_cash_on_cash?: number | null;
  total_project_cost?: number | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export type InvestmentStrategy = 'core' | 'value_add' | 'opportunistic';

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

// ============================================================================
// CRM Types
// ============================================================================

export type ContactType =
  | 'owner' | 'tenant' | 'buyer' | 'seller' | 'broker' | 'lender'
  | 'attorney' | 'property_manager' | 'investor' | 'developer'
  | 'appraiser' | 'contractor' | 'other';

export type CompanyType =
  | 'brokerage' | 'investment_firm' | 'developer' | 'tenant_company'
  | 'lender' | 'law_firm' | 'management_company' | 'construction'
  | 'appraisal_firm' | 'title_company' | 'other';

export type CrmDealType = 'sale' | 'lease' | 'listing' | 'acquisition' | 'disposition';

export type DealStage =
  | 'prospecting' | 'qualification' | 'proposal' | 'negotiation'
  | 'under_contract' | 'due_diligence' | 'closing' | 'closed_won' | 'closed_lost';

export type ActivityType =
  | 'call' | 'email' | 'meeting' | 'note' | 'task' | 'site_visit'
  | 'document_sent' | 'offer_made' | 'other';

export type DealRole =
  | 'buyer' | 'seller' | 'listing_broker' | 'buyers_broker' | 'co_broker'
  | 'lender' | 'attorney_buyer' | 'attorney_seller' | 'escrow_officer'
  | 'title_officer' | 'appraiser' | 'inspector' | 'property_manager'
  | 'tenant' | 'other';

export type DealPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Company {
  id: string;
  name: string;
  company_type: CompanyType;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  tags: string[];
  notes?: string;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  contacts?: Contact[];
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  company_id?: string;
  title?: string;
  contact_type: ContactType;
  license_number?: string;
  source?: string;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  tags: string[];
  notes?: string;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  company?: { id: string; name: string; company_type?: CompanyType };
  deals?: DealContactLink[];
  activities?: Activity[];
  linked_properties?: ContactPropertyLink[];
}

export interface CrmDeal {
  id: string;
  deal_name: string;
  deal_type: CrmDealType;
  stage: DealStage;
  description?: string;
  property_id?: string;
  master_property_id?: string;
  deal_value?: number;
  asking_price?: number;
  offer_price?: number;
  final_price?: number;
  commission_total?: number;
  commission_percent?: number;
  commission_split_percent?: number;
  commission_notes?: string;
  expected_close_date?: string;
  actual_close_date?: string;
  listing_date?: string;
  expiration_date?: string;
  probability_percent: number;
  priority: DealPriority;
  assigned_to?: string;
  stage_entered_at: string;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  assigned_user?: { id: string; full_name: string; email?: string };
  contacts?: DealContactLink[];
  activities?: Activity[];
  stage_history?: DealStageHistoryEntry[];
}

export interface DealContactLink {
  id: string;
  role: DealRole;
  contact?: { id: string; first_name: string; last_name: string; email?: string; phone?: string; company_id?: string };
  deal?: { id: string; deal_name: string; deal_type: CrmDealType; stage: DealStage; deal_value?: number };
}

export interface ContactPropertyLink {
  id: string;
  contact_id: string;
  master_property_id?: string;
  property_id?: string;
  relationship: string;
  notes?: string;
}

export interface Activity {
  id: string;
  activity_type: ActivityType;
  subject: string;
  description?: string;
  contact_id?: string;
  deal_id?: string;
  company_id?: string;
  property_id?: string;
  due_date?: string;
  is_completed: boolean;
  activity_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: { id: string; first_name: string; last_name: string };
  deal?: { id: string; deal_name: string };
}

export interface DealStageHistoryEntry {
  id: string;
  deal_id: string;
  from_stage?: DealStage;
  to_stage: DealStage;
  changed_by: string;
  changed_at: string;
  notes?: string;
  changed_by_user?: { id: string; full_name: string };
}

export interface PipelineColumn {
  stage: DealStage;
  count: number;
  total_value: number;
  deals: CrmDeal[];
}

export interface DealAnalyticsData {
  total_deals: number;
  active_deals: number;
  closed_won: number;
  closed_lost: number;
  win_rate: number;
  avg_deal_size: number;
  total_commission_earned: number;
  total_pipeline_value: number;
  weighted_pipeline_value: number;
}

// ============================================================================
// Document Generator Types (Phase 2)
// ============================================================================

export type TemplateType = 'brochure' | 'om' | 'proposal';

export type ContentType =
  | 'property_description'
  | 'executive_summary'
  | 'location_analysis'
  | 'property_highlights'
  | 'market_analysis'
  | 'team_intro';

export interface GeneratedContentSection {
  content: string;
  cached: boolean;
  tokens_used?: number;
}

export interface GenerateContentResponse {
  success: boolean;
  property: Partial<MasterProperty>;
  transaction: {
    sale_price?: number;
    asking_price?: number;
    price_per_sf?: number;
    cap_rate?: number;
    noi?: number;
    transaction_type?: string;
    transaction_date?: string;
  } | null;
  content: Record<string, GeneratedContentSection>;
}

export interface GeneratedDocument {
  id: string;
  master_property_id?: string;
  template_type: TemplateType;
  title: string;
  file_url?: string;
  content_snapshot?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedDocumentsResponse {
  success: boolean;
  documents: GeneratedDocument[];
}

export interface GeneratedDocumentResponse {
  success: boolean;
  document: GeneratedDocument;
}

// ============================================================================
// Listing Sites Types (Phase 4)
// ============================================================================

export type ListingTemplateStyle = 'modern' | 'classic' | 'minimal';

export interface ListingSite {
  id: string;
  master_property_id: string;
  slug: string;
  is_published: boolean;
  custom_headline?: string;
  custom_description?: string;
  template_style: ListingTemplateStyle;
  seo_title?: string;
  seo_description?: string;
  lead_capture_email?: string;
  virtual_tour_url?: string;
  brochure_doc_id?: string;
  om_doc_id?: string;
  view_count: number;
  lead_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  master_properties?: MasterProperty;
}

export interface ListingLead {
  id: string;
  listing_site_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: string;
  contact_id?: string;
  is_converted: boolean;
  created_at: string;
}

export interface PublicListingData {
  id: string;
  slug: string;
  is_published: boolean;
  custom_headline?: string;
  custom_description?: string;
  template_style: ListingTemplateStyle;
  virtual_tour_url?: string;
  view_count: number;
  property: MasterProperty;
  transaction: Transaction | null;
  photos: Array<{
    id: string;
    file_path: string;
    file_name: string;
    photo_type: string;
    caption?: string;
    is_primary: boolean;
    sort_order: number;
    url: string;
  }>;
  documents: Array<{
    id: string;
    template_type: string;
    title: string;
    file_url?: string;
  }>;
  broker: {
    full_name?: string;
    company_name?: string;
    company_phone?: string;
    company_email?: string;
    company_logo_url?: string;
  } | null;
}

// ============================================================================
// Prospecting Types (Phase 5)
// ============================================================================

export type ProspectListItemStatus = 'pending' | 'contacted' | 'qualified' | 'not_interested';

export interface ProspectListFilters {
  // Multi-select
  property_type?: string[];
  city?: string[];
  state?: string[];
  zip?: string[];
  submarket?: string[];
  property_subtype?: string[];
  // Ranges
  building_size_min?: number;
  building_size_max?: number;
  lot_size_acres_min?: number;
  lot_size_acres_max?: number;
  year_built_min?: number;
  year_built_max?: number;
  sale_price_min?: number;
  sale_price_max?: number;
  price_per_sf_min?: number;
  price_per_sf_max?: number;
  cap_rate_min?: number;
  cap_rate_max?: number;
  // Text search
  owner_name?: string;
  search?: string;
}

export interface ProspectList {
  id: string;
  name: string;
  description?: string;
  filters: ProspectListFilters;
  result_count: number;
  last_refreshed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProspectListItem {
  id: string;
  list_id: string;
  master_property_id: string;
  status: ProspectListItemStatus;
  notes?: string;
  added_at: string;
  property?: MasterProperty;
}

// ============================================================================
// Owner Research Types (Phase 6)
// ============================================================================

export type OwnerEntityType =
  | 'individual' | 'llc' | 'trust' | 'corporation' | 'reit'
  | 'partnership' | 'government' | 'nonprofit' | 'unknown';

export type ResearchSource = 'ai' | 'manual' | 'county_records' | 'other';

export interface OwnerResearch {
  id: string;
  master_property_id: string;
  owner_name?: string;
  owner_entity_type: OwnerEntityType;
  registered_agent?: string;
  mailing_address?: string;
  phone?: string;
  email?: string;
  other_properties?: Array<Record<string, unknown>>;
  portfolio_estimate?: number;
  research_source: ResearchSource;
  research_notes?: string;
  ai_summary?: string;
  raw_data?: {
    outreach_recommendations?: string[];
    red_flags?: string[];
    opportunities?: string[];
    token_usage?: { inputTokens: number; outputTokens: number };
  };
  researched_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Email Campaign Types (Phase 7)
// ============================================================================

export type CampaignType = 'new_listing' | 'price_reduction' | 'just_closed' | 'market_update' | 'custom';
export type CampaignStatus = 'draft' | 'sending' | 'sent';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

export interface EmailCampaign {
  id: string;
  name: string;
  campaign_type: CampaignType;
  subject?: string;
  html_body?: string;
  master_property_id?: string;
  status: CampaignStatus;
  sent_at?: string;
  total_recipients: number;
  total_sent: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EmailRecipient {
  id: string;
  campaign_id: string;
  contact_id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status: RecipientStatus;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

// ============================================================================
// Report Types (Phase 8)
// ============================================================================

export type ReportType =
  | 'pipeline-forecast'
  | 'broker-production'
  | 'revenue'
  | 'activity-summary'
  | 'property-analytics'
  | 'prospecting';

export interface PipelineForecastData {
  success: boolean;
  deals_by_stage: {
    stage: string;
    count: number;
    total_value: number;
    weighted_value: number;
  }[];
  weighted_forecast_total: number;
  monthly_projections: {
    month: string;
    total_value: number;
    weighted_value: number;
    deal_count: number;
  }[];
  total_pipeline: number;
  active_deals: number;
}

export interface BrokerProductionData {
  success: boolean;
  brokers: {
    broker_id: string;
    broker_name: string;
    deals_closed: number;
    total_deal_value: number;
    total_commission: number;
  }[];
  totals: {
    deals_closed: number;
    total_deal_value: number;
    total_commission: number;
  };
}

export interface RevenueReportData {
  success: boolean;
  monthly: {
    month: string;
    commission: number;
    deal_value: number;
    deal_count: number;
  }[];
  type_breakdown: {
    deal_type: string;
    commission: number;
    count: number;
    deal_value: number;
  }[];
  totals: {
    commission: number;
    deal_value: number;
    deal_count: number;
  };
}

export interface ActivitySummaryData {
  success: boolean;
  by_type: {
    type: string;
    count: number;
    completed: number;
  }[];
  by_period: {
    month: string;
    count: number;
  }[];
  task_completion: {
    total: number;
    completed: number;
    rate: number;
  };
  total_activities: number;
}

export interface PropertyAnalyticsData {
  success: boolean;
  by_type: {
    type: string;
    count: number;
    total_value: number;
    avg_price_sf: number;
  }[];
  by_submarket: {
    submarket: string;
    count: number;
    total_value: number;
    avg_price_sf: number;
  }[];
  price_sf_distribution: {
    range: string;
    count: number;
  }[];
  cap_rate_distribution: {
    range: string;
    count: number;
  }[];
  summary: {
    total_properties: number;
    total_value: number;
    avg_price_sf: number;
    avg_cap_rate: number;
  };
}

export interface ProspectingReportData {
  success: boolean;
  status_distribution: {
    status: string;
    count: number;
  }[];
  conversion_rates: {
    total: number;
    contacted: number;
    qualified: number;
    not_interested: number;
    contact_rate: number;
    qualification_rate: number;
  };
  per_list_breakdown: {
    list_id: string;
    list_name: string;
    total_items: number;
    [status: string]: string | number;
  }[];
  total_lists: number;
  total_items: number;
}

// ============================================================================
// Deal Room Types (Phase 9)
// ============================================================================

export type DealRoomDocumentCategory =
  | 'loi' | 'psa' | 'title' | 'environmental' | 'appraisal'
  | 'lease' | 'financial' | 'other';

export interface DealRoomDocument {
  id: string;
  deal_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  category: DealRoomDocumentCategory;
  description?: string;
  is_visible_to_external: boolean;
  uploaded_by?: string;
  created_at: string;
}

export interface DealRoomInvite {
  id: string;
  deal_id: string;
  email: string;
  name?: string;
  access_token: string;
  expires_at?: string;
  created_by?: string;
  created_at: string;
  last_accessed_at?: string;
}

export interface DealRoomActivityEntry {
  id: string;
  deal_id: string;
  document_id?: string;
  invite_id?: string;
  user_id?: string;
  action: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PublicDealRoomData {
  deal_name: string;
  invite_name?: string;
  invite_email?: string;
  documents: Array<{
    id: string;
    file_name: string;
    file_size?: number;
    file_type?: string;
    category: string;
    description?: string;
    created_at: string;
  }>;
}

// ============================================================================
// Playbooks & Deal Tasks Types (Phase 9)
// ============================================================================

export interface TaskPlaybook {
  id: string;
  name: string;
  description?: string;
  deal_type?: string;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  tasks?: PlaybookTask[];
  playbook_tasks?: Array<{ count: number }>;
}

export interface PlaybookTask {
  id: string;
  playbook_id: string;
  title: string;
  description?: string;
  stage?: string;
  due_offset_days?: number;
  is_required: boolean;
  sort_order: number;
}

export interface DealTask {
  id: string;
  deal_id: string;
  playbook_id?: string;
  title: string;
  description?: string;
  stage?: string;
  assigned_to?: string;
  due_date?: string;
  is_required: boolean;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  sort_order: number;
  created_at: string;
  assigned_user?: { id: string; full_name: string };
}

// ============================================================================
// Syndication Types (Phase 10)
// ============================================================================

export interface SyndicationPlatform {
  id: string;
  name: string;
  display_name: string;
  logo_url: string | null;
  website_url: string | null;
  integration_type: 'api' | 'csv_export' | 'manual';
  is_active: boolean;
}

export interface SyndicationListing {
  id: string;
  listing_site_id: string;
  platform_id: string;
  platform?: SyndicationPlatform;
  listing_site?: ListingSite & { master_properties?: MasterProperty };
  external_listing_id: string | null;
  external_listing_url: string | null;
  status: 'draft' | 'pending' | 'published' | 'synced' | 'error' | 'delisted';
  published_at: string | null;
  last_synced_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyndicationActivityEntry {
  id: string;
  syndication_listing_id: string;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
}

export interface SyndicationExport {
  format: 'csv' | 'json';
  data: string;
  file_name: string;
  platform_name: string;
}

export interface ListingSitesResponse {
  success: boolean;
  listing_sites: ListingSite[];
}

export interface PublicListingResponse {
  success: boolean;
  listing: PublicListingData;
}
