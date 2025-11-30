/**
 * Database Types - Apex Deal Analyzer
 *
 * TypeScript types corresponding to the Supabase database schema
 * Keep these in sync with backend/database/schema.sql
 */

// =====================================================
// ENUMS
// =====================================================

export enum UserRole {
  ADMIN = 'admin',
  BROKER = 'broker',
  ANALYST = 'analyst',
  INVESTOR = 'investor',
}

export enum PropertyType {
  WAREHOUSE = 'warehouse',
  DISTRIBUTION_CENTER = 'distribution_center',
  MANUFACTURING = 'manufacturing',
  FLEX_SPACE = 'flex_space',
  COLD_STORAGE = 'cold_storage',
  OTHER = 'other',
}

export enum DocumentType {
  OFFERING_MEMORANDUM = 'offering_memorandum',
  TITLE_REPORT = 'title_report',
  COMP = 'comp',
  LEASE = 'lease',
  APPRAISAL = 'appraisal',
  ENVIRONMENTAL_REPORT = 'environmental_report',
  OTHER = 'other',
}

export enum ExtractionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum DealStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

// =====================================================
// DATABASE TABLES
// =====================================================

export interface Profile {
  id: string; // UUID, references auth.users
  email: string;
  full_name: string;
  role: UserRole;
  organization?: string;
  phone_number?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string; // ISO timestamp
  updated_at: string;
}

export interface Property {
  id: string; // UUID
  created_by: string; // UUID, references profiles

  // Property Details
  address: string;
  city: string;
  state: string; // 2-letter code
  zip_code: string;
  county?: string;
  apn?: string; // Assessor's Parcel Number

  // Property Characteristics
  property_type: PropertyType;
  square_footage?: number;
  lot_size_acres?: number;
  year_built?: number;
  building_class?: string; // A, B, C

  // Financial Data
  asking_price?: number;
  sale_price?: number;
  price_per_sqft?: number;

  // Investment Metrics
  cap_rate?: number; // Percentage (0-100)
  noi?: number; // Net Operating Income
  gross_income?: number;
  operating_expenses?: number;

  // Occupancy
  occupancy_rate?: number; // Percentage (0-100)
  number_of_tenants?: number;

  // Additional Details
  description?: string;
  notes?: string;

  // Metadata
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string; // UUID
  property_id?: string; // UUID, references properties (nullable for unattached docs)
  uploaded_by: string; // UUID, references profiles

  // File Information
  file_name: string;
  file_path: string; // Supabase Storage path
  file_size: number; // Bytes
  document_type: DocumentType;

  // Extraction Status
  extraction_status: ExtractionStatus;
  extracted_data?: Record<string, any>; // JSONB - flexible structure
  extraction_error?: string;

  // Metadata
  uploaded_at: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Comp {
  id: string; // UUID
  property_id: string; // UUID, references properties (subject property)
  created_by: string; // UUID, references profiles

  // Comp Property Details
  comp_address: string;
  comp_city: string;
  comp_state: string;
  comp_zip_code?: string;

  // Comp Characteristics
  comp_property_type: PropertyType;
  comp_square_footage?: number;
  comp_year_built?: number;

  // Comp Sale Information
  comp_sale_price: number;
  comp_sale_date: string; // ISO date
  comp_price_per_sqft?: number;
  comp_cap_rate?: number;

  // Similarity / Adjustments
  distance_miles?: number;
  similarity_score?: number; // 0-100
  adjustment_notes?: string;

  // Metadata
  source?: string; // Where comp came from (CoStar, LoopNet, etc.)
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string; // UUID
  created_by: string; // UUID, references profiles

  // Deal Information
  deal_name: string;
  description?: string;

  // Status
  status: DealStatus;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface DealProperty {
  deal_id: string; // UUID, references deals
  property_id: string; // UUID, references properties
  added_at: string;
}

export interface SharedAccess {
  id: string; // UUID
  property_id?: string; // UUID, references properties (one of these must be set)
  deal_id?: string; // UUID, references deals
  user_id: string; // UUID, references profiles (who it's shared with)

  // Permissions
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;

  // Metadata
  shared_by: string; // UUID, references profiles
  shared_at: string;
  expires_at?: string; // Optional expiration
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface PropertyWithDocuments extends Property {
  documents: Document[];
}

export interface PropertyWithComps extends Property {
  comps: Comp[];
}

export interface PropertyFull extends Property {
  documents: Document[];
  comps: Comp[];
  created_by_profile: Profile;
}

export interface DealWithProperties extends Deal {
  properties: Property[];
}

// =====================================================
// REQUEST/RESPONSE PAYLOADS
// =====================================================

export interface CreatePropertyRequest {
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: PropertyType;
  square_footage?: number;
  asking_price?: number;
  description?: string;
  // ... other optional fields
}

export interface UpdatePropertyRequest {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_type?: PropertyType;
  sale_price?: number;
  cap_rate?: number;
  noi?: number;
  // ... any other fields that can be updated
}

export interface UploadDocumentRequest {
  property_id?: string;
  document_type: DocumentType;
  // file is handled by multipart/form-data
}

export interface ExtractedPropertyData {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  square_footage?: number;
  sale_price?: number;
  cap_rate?: number;
  noi?: number;
  property_type?: PropertyType;
  year_built?: number;
  // ... any other fields AI can extract
}

// =====================================================
// HELPER TYPES
// =====================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Database insert types (without auto-generated fields)
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type PropertyInsert = Omit<Property, 'id' | 'created_at' | 'updated_at'>;
export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'uploaded_at'>;
export type CompInsert = Omit<Comp, 'id' | 'created_at' | 'updated_at'>;
export type DealInsert = Omit<Deal, 'id' | 'created_at' | 'updated_at'>;
