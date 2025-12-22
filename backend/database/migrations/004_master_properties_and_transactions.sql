-- ============================================================================
-- Migration: Master Properties Database with Transaction History
-- ============================================================================
-- This migration creates a comprehensive CRE database that:
-- 1. Separates properties (physical assets) from transactions (sales/leases)
-- 2. Supports all property types (industrial, retail, office, land, residential)
-- 3. Enables bulk CSV uploads with flexible column mapping
-- 4. Tracks multiple transactions per property over time
-- 5. Implements role-based access control (admin vs member)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add roles to profiles
-- ============================================================================

-- Add role column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member'));

-- Make the first user (you) an admin
-- We'll update this after checking who exists
UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1);

-- ============================================================================
-- STEP 2: Create property type enums
-- ============================================================================

-- Drop if exists to allow re-running
DROP TYPE IF EXISTS master_property_type CASCADE;
DROP TYPE IF EXISTS property_subtype CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS data_source CASCADE;

CREATE TYPE master_property_type AS ENUM (
  'industrial',
  'retail',
  'office',
  'multifamily',
  'land',
  'residential',
  'special_purpose'
);

CREATE TYPE property_subtype AS ENUM (
  -- Industrial
  'warehouse',
  'distribution',
  'manufacturing',
  'flex',
  'cold_storage',
  'truck_terminal',
  -- Retail
  'strip_center',
  'standalone_retail',
  'restaurant',
  'auto_service',
  'shopping_mall',
  -- Office
  'office_class_a',
  'office_class_b',
  'office_class_c',
  'medical_office',
  'creative_office',
  -- Multifamily
  'apartments',
  'condos',
  'townhomes',
  'senior_living',
  -- Land
  'land_industrial',
  'land_commercial',
  'land_residential',
  'land_agricultural',
  'land_mixed_use',
  -- Residential
  'single_family',
  'townhouse',
  'mobile_home',
  -- Special Purpose
  'self_storage',
  'hospitality',
  'religious',
  'school',
  'other'
);

CREATE TYPE transaction_type AS ENUM (
  'sale',
  'lease',
  'listing',
  'off_market'
);

CREATE TYPE data_source AS ENUM (
  'costar',
  'crexi',
  'loopnet',
  'manual',
  'pdf_extract',
  'mls',
  'public_records',
  'other'
);

-- ============================================================================
-- STEP 3: Create master_properties table
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Info
  address TEXT NOT NULL,
  address_normalized TEXT, -- Lowercase, standardized for matching
  property_name TEXT,
  building_park TEXT,

  -- Location
  city TEXT,
  state TEXT,
  zip TEXT,
  county TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  submarket TEXT,

  -- Classification
  property_type master_property_type,
  property_subtype property_subtype,
  building_status TEXT, -- Existing, Under Construction, Proposed
  building_class TEXT, -- A, B, C
  zoning TEXT,

  -- Size
  building_size INTEGER, -- SF (RBA from CoStar)
  land_area_sf INTEGER,
  lot_size_acres DECIMAL(10, 2),

  -- Building Details
  year_built INTEGER,
  year_renovated INTEGER,
  number_of_floors INTEGER,
  number_of_units INTEGER, -- For multifamily

  -- Industrial Specific
  clear_height_ft DECIMAL(5, 1),
  dock_doors INTEGER,
  grade_doors INTEGER,
  rail_served BOOLEAN DEFAULT false,
  sprinkler_type TEXT,
  power_amps INTEGER,
  office_percentage DECIMAL(5, 2),

  -- Retail Specific
  frontage_ft INTEGER,
  parking_spaces INTEGER,
  parking_ratio DECIMAL(5, 2),
  anchor_tenant TEXT,

  -- Current Status
  percent_leased DECIMAL(5, 2),

  -- Contacts (from CoStar)
  owner_name TEXT,
  owner_contact TEXT,
  owner_address TEXT,
  property_manager_name TEXT,
  property_manager_phone TEXT,
  leasing_company_name TEXT,
  leasing_company_phone TEXT,
  leasing_company_contact TEXT,
  developer_name TEXT,
  architect_name TEXT,

  -- External IDs (for deduplication)
  costar_id TEXT,
  crexi_id TEXT,
  external_ids JSONB DEFAULT '{}', -- Flexible storage for any other IDs

  -- Data Quality
  source data_source DEFAULT 'manual',
  raw_import_data JSONB, -- Store original CSV row for unmapped columns
  verified_at TIMESTAMPTZ,
  verification_reminder_at TIMESTAMPTZ,
  notes TEXT,

  -- Ownership
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,

  -- Constraints
  UNIQUE(address_normalized, city, state)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_master_properties_location ON master_properties(city, state);
CREATE INDEX IF NOT EXISTS idx_master_properties_type ON master_properties(property_type);
CREATE INDEX IF NOT EXISTS idx_master_properties_created_by ON master_properties(created_by);
CREATE INDEX IF NOT EXISTS idx_master_properties_costar_id ON master_properties(costar_id);
CREATE INDEX IF NOT EXISTS idx_master_properties_address_normalized ON master_properties(address_normalized);
CREATE INDEX IF NOT EXISTS idx_master_properties_verification ON master_properties(verification_reminder_at)
  WHERE verification_reminder_at IS NOT NULL;

-- ============================================================================
-- STEP 4: Create transactions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to property
  property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,

  -- Transaction Details
  transaction_type transaction_type NOT NULL,
  transaction_date DATE,
  recording_date DATE,

  -- Sale Info
  sale_price DECIMAL(15, 2),
  price_per_sf DECIMAL(10, 2),
  cap_rate DECIMAL(5, 2),
  noi DECIMAL(15, 2),

  -- Lease Info (if transaction_type = 'lease')
  tenant_name TEXT,
  lease_term_months INTEGER,
  rent_per_sf_year DECIMAL(10, 2),
  lease_type TEXT, -- NNN, Gross, Modified Gross
  lease_start_date DATE,
  lease_end_date DATE,

  -- Parties
  buyer_name TEXT,
  seller_name TEXT,
  broker_name TEXT,
  broker_company TEXT,

  -- Listing Info (if transaction_type = 'listing')
  asking_price DECIMAL(15, 2),
  asking_price_per_sf DECIMAL(10, 2),
  days_on_market INTEGER,
  listing_status TEXT, -- Active, Pending, Withdrawn

  -- Data Quality
  source data_source DEFAULT 'manual',
  source_document_url TEXT,
  raw_import_data JSONB,
  notes TEXT,

  -- Ownership
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_property ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);

-- ============================================================================
-- STEP 5: Create import_batches table (track bulk uploads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  filename TEXT,
  source data_source,
  total_rows INTEGER,
  imported_rows INTEGER,
  skipped_rows INTEGER,
  error_rows INTEGER,

  column_mapping JSONB, -- Store the column mapping used
  errors JSONB, -- Store any row-level errors

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- STEP 6: Row Level Security Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE master_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Master Properties Policies
-- Admins can see all, members see only their own
CREATE POLICY "Admins can view all properties" ON master_properties
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view own properties" ON master_properties
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert properties" ON master_properties
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update all properties" ON master_properties
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can update own properties" ON master_properties
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete all properties" ON master_properties
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can delete own properties" ON master_properties
  FOR DELETE
  USING (created_by = auth.uid());

-- Transactions Policies (similar pattern)
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view own transactions" ON transactions
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert transactions" ON transactions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update all transactions" ON transactions
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can update own transactions" ON transactions
  FOR UPDATE
  USING (created_by = auth.uid());

-- Import Batches Policies
CREATE POLICY "Users can view own imports" ON import_batches
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert imports" ON import_batches
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- STEP 7: Helper Functions
-- ============================================================================

-- Function to normalize addresses for matching
CREATE OR REPLACE FUNCTION normalize_address(addr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              COALESCE(addr, ''),
              '\s+', ' ', 'g'  -- Multiple spaces to single
            ),
            '\.$', '', 'g'  -- Remove trailing periods
          ),
          ' street| st\.?| avenue| ave\.?| boulevard| blvd\.?| drive| dr\.?| road| rd\.?| lane| ln\.?| court| ct\.?| place| pl\.?| way',
          '', 'gi'  -- Remove street suffixes
        ),
        ' north| south| east| west| n\.?| s\.?| e\.?| w\.?',
        '', 'gi'  -- Remove directionals
      ),
      '[^a-z0-9]', '', 'g'  -- Keep only alphanumeric
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-populate normalized address
CREATE OR REPLACE FUNCTION set_normalized_address()
RETURNS TRIGGER AS $$
BEGIN
  NEW.address_normalized := normalize_address(NEW.address);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_address
  BEFORE INSERT OR UPDATE ON master_properties
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_address();

-- Function to set verification reminder (1 year from now)
CREATE OR REPLACE FUNCTION set_verification_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verified_at IS NOT NULL AND NEW.verified_at != OLD.verified_at THEN
    NEW.verification_reminder_at := NEW.verified_at + INTERVAL '1 year';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verification_reminder
  BEFORE UPDATE ON master_properties
  FOR EACH ROW
  EXECUTE FUNCTION set_verification_reminder();

-- ============================================================================
-- STEP 8: Migrate existing data
-- ============================================================================

-- Migrate existing properties to master_properties
INSERT INTO master_properties (
  id,
  address,
  property_name,
  city,
  state,
  zip,
  county,
  property_type,
  building_status,
  building_class,
  building_size,
  land_area_sf,
  year_built,
  clear_height_ft,
  dock_doors,
  percent_leased,
  source,
  created_by,
  created_at,
  updated_at,
  is_deleted
)
SELECT
  id,
  address,
  NULL, -- property_name
  city,
  state,
  zip_code,
  NULL, -- county
  CASE
    WHEN property_type = 'warehouse' THEN 'industrial'::master_property_type
    WHEN property_type = 'distribution_center' THEN 'industrial'::master_property_type
    WHEN property_type = 'manufacturing' THEN 'industrial'::master_property_type
    WHEN property_type = 'flex_space' THEN 'industrial'::master_property_type
    WHEN property_type = 'cold_storage' THEN 'industrial'::master_property_type
    ELSE 'industrial'::master_property_type
  END,
  status,
  building_class,
  building_size,
  lot_size,
  year_built,
  clear_height,
  dock_doors,
  occupancy_rate,
  'manual'::data_source,
  created_by,
  created_at,
  updated_at,
  is_deleted
FROM properties
WHERE NOT EXISTS (
  SELECT 1 FROM master_properties mp WHERE mp.id = properties.id
);

-- Create transactions from existing properties (if they have price data)
INSERT INTO transactions (
  property_id,
  transaction_type,
  sale_price,
  price_per_sf,
  cap_rate,
  noi,
  source,
  notes,
  created_by,
  created_at
)
SELECT
  id,
  'listing'::transaction_type,
  price,
  price_per_sqft,
  cap_rate,
  noi,
  'manual'::data_source,
  'Migrated from original properties table',
  created_by,
  created_at
FROM properties
WHERE price IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM transactions t WHERE t.property_id = properties.id
);

-- Migrate existing comps to master_properties + transactions
INSERT INTO master_properties (
  address,
  city,
  state,
  building_size,
  year_built,
  source,
  created_by,
  created_at
)
SELECT DISTINCT ON (c.comp_address, c.comp_city, c.comp_state)
  c.comp_address,
  c.comp_city,
  c.comp_state,
  c.comp_square_footage,
  c.comp_year_built,
  'manual'::data_source,
  c.created_by,
  c.created_at
FROM comps c
WHERE c.comp_address IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM master_properties mp
  WHERE normalize_address(mp.address) = normalize_address(c.comp_address)
  AND LOWER(mp.city) = LOWER(c.comp_city)
);

-- Create sale transactions from comps
INSERT INTO transactions (
  property_id,
  transaction_type,
  transaction_date,
  sale_price,
  price_per_sf,
  cap_rate,
  source,
  notes,
  created_by,
  created_at
)
SELECT
  mp.id,
  'sale'::transaction_type,
  c.comp_sale_date,
  c.comp_sale_price,
  c.comp_price_per_sqft,
  c.comp_cap_rate,
  'manual'::data_source,
  CONCAT('Migrated from comps. Original comp ID: ', c.id, '. Notes: ', COALESCE(c.adjustment_notes, '')),
  c.created_by,
  c.created_at
FROM comps c
JOIN master_properties mp ON normalize_address(mp.address) = normalize_address(c.comp_address)
  AND LOWER(mp.city) = LOWER(c.comp_city)
WHERE c.comp_sale_price IS NOT NULL;

-- ============================================================================
-- STEP 9: Create view for easy querying
-- ============================================================================

CREATE OR REPLACE VIEW property_with_latest_transaction AS
SELECT
  mp.*,
  t.transaction_type AS latest_transaction_type,
  t.transaction_date AS latest_transaction_date,
  t.sale_price AS latest_sale_price,
  t.price_per_sf AS latest_price_per_sf,
  t.cap_rate AS latest_cap_rate
FROM master_properties mp
LEFT JOIN LATERAL (
  SELECT * FROM transactions
  WHERE property_id = mp.id
  ORDER BY COALESCE(transaction_date, created_at) DESC
  LIMIT 1
) t ON true
WHERE mp.is_deleted = false;

-- ============================================================================
-- Done!
-- ============================================================================
