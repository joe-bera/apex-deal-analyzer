-- =====================================================
-- Apex Deal Analyzer - Database Schema
-- =====================================================
-- This file contains the complete database schema for the
-- Apex Real Estate Services Deal Analyzer platform.
--
-- Usage:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Run the query to create all tables, policies, and functions
--
-- Or use the Supabase CLI:
-- supabase db reset --db-url "your-database-url"
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('admin', 'broker', 'analyst', 'investor');
CREATE TYPE property_type AS ENUM (
  'warehouse',
  'distribution_center',
  'manufacturing',
  'flex_space',
  'cold_storage',
  'other'
);
CREATE TYPE document_type AS ENUM (
  'offering_memorandum',
  'title_report',
  'comp',
  'lease',
  'appraisal',
  'environmental_report',
  'other'
);
CREATE TYPE extraction_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- =====================================================
-- TABLES
-- =====================================================

-- -----------------------------------------------------
-- Profiles Table (extends Supabase auth.users)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'analyst',
  organization TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users with application-specific fields';

-- -----------------------------------------------------
-- Properties Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Property Details
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL CHECK (length(state) = 2),
  zip_code TEXT NOT NULL CHECK (zip_code ~ '^\d{5}(-\d{4})?$'),
  county TEXT,
  apn TEXT, -- Assessor's Parcel Number

  -- Property Characteristics
  property_type property_type NOT NULL,
  square_footage INTEGER CHECK (square_footage > 0),
  lot_size_acres DECIMAL(10, 2),
  year_built INTEGER CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE) + 2),
  building_class TEXT, -- A, B, C classification

  -- Financial Data
  asking_price DECIMAL(15, 2) CHECK (asking_price > 0),
  sale_price DECIMAL(15, 2) CHECK (sale_price > 0),
  price_per_sqft DECIMAL(10, 2) CHECK (price_per_sqft > 0),

  -- Investment Metrics
  cap_rate DECIMAL(5, 2) CHECK (cap_rate >= 0 AND cap_rate <= 100),
  noi DECIMAL(15, 2), -- Net Operating Income (can be negative)
  gross_income DECIMAL(15, 2),
  operating_expenses DECIMAL(15, 2),

  -- Occupancy
  occupancy_rate DECIMAL(5, 2) CHECK (occupancy_rate >= 0 AND occupancy_rate <= 100),
  number_of_tenants INTEGER CHECK (number_of_tenants >= 0),

  -- Additional Details
  description TEXT,
  notes TEXT,

  -- Metadata
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_properties_created_by ON properties(created_by);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_property_type ON properties(property_type);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

COMMENT ON TABLE properties IS 'Commercial real estate properties being analyzed';

-- -----------------------------------------------------
-- Documents Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- File Information
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  document_type document_type NOT NULL,

  -- Extraction Status
  extraction_status extraction_status DEFAULT 'pending',
  extracted_data JSONB, -- Store AI-extracted data as JSON
  extraction_error TEXT,

  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_documents_property_id ON documents(property_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_extraction_status ON documents(extraction_status);
CREATE INDEX idx_documents_document_type ON documents(document_type);

COMMENT ON TABLE documents IS 'PDF documents and other files uploaded for analysis';

-- -----------------------------------------------------
-- Comps (Comparable Sales) Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS comps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE, -- Subject property
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Comp Property Details
  comp_address TEXT NOT NULL,
  comp_city TEXT NOT NULL,
  comp_state TEXT NOT NULL,
  comp_zip_code TEXT,

  -- Comp Characteristics
  comp_property_type property_type NOT NULL,
  comp_square_footage INTEGER CHECK (comp_square_footage > 0),
  comp_year_built INTEGER,

  -- Comp Sale Information
  comp_sale_price DECIMAL(15, 2) NOT NULL CHECK (comp_sale_price > 0),
  comp_sale_date DATE NOT NULL,
  comp_price_per_sqft DECIMAL(10, 2),
  comp_cap_rate DECIMAL(5, 2),

  -- Similarity / Adjustments
  distance_miles DECIMAL(6, 2), -- Distance from subject property
  similarity_score INTEGER CHECK (similarity_score >= 0 AND similarity_score <= 100), -- 0-100 rating
  adjustment_notes TEXT,

  -- Metadata
  source TEXT, -- Where this comp came from (CoStar, LoopNet, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_comps_property_id ON comps(property_id);
CREATE INDEX idx_comps_created_by ON comps(created_by);
CREATE INDEX idx_comps_sale_date ON comps(comp_sale_date DESC);

COMMENT ON TABLE comps IS 'Comparable sales for property valuation analysis';

-- -----------------------------------------------------
-- Deals (Analysis Sessions) Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Deal Information
  deal_name TEXT NOT NULL,
  description TEXT,

  -- Properties in this deal (many-to-many relationship)
  -- We'll create a junction table for this

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_created_by ON deals(created_by);
CREATE INDEX idx_deals_status ON deals(status);

COMMENT ON TABLE deals IS 'Deal analysis sessions grouping multiple properties';

-- -----------------------------------------------------
-- Deal Properties Junction Table (Many-to-Many)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_properties (
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (deal_id, property_id)
);

CREATE INDEX idx_deal_properties_deal_id ON deal_properties(deal_id);
CREATE INDEX idx_deal_properties_property_id ON deal_properties(property_id);

COMMENT ON TABLE deal_properties IS 'Junction table linking deals and properties (many-to-many)';

-- -----------------------------------------------------
-- Shared Access Table (for investor access control)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What is being shared
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,

  -- Who it's shared with
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Permissions
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,

  -- Metadata
  shared_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration

  -- Ensure at least one of property_id or deal_id is set
  CHECK (
    (property_id IS NOT NULL AND deal_id IS NULL) OR
    (property_id IS NULL AND deal_id IS NOT NULL)
  )
);

CREATE INDEX idx_shared_access_user_id ON shared_access(user_id);
CREATE INDEX idx_shared_access_property_id ON shared_access(property_id);
CREATE INDEX idx_shared_access_deal_id ON shared_access(deal_id);

COMMENT ON TABLE shared_access IS 'Control access to properties and deals for specific users (e.g., investors)';

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- -----------------------------------------------------
-- Function: Update updated_at timestamp
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comps_updated_at BEFORE UPDATE ON comps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Function: Auto-create profile on user signup
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'analyst')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- Profiles Policies
-- -----------------------------------------------------

-- Users can view all profiles (for team collaboration)
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Only admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- -----------------------------------------------------
-- Properties Policies
-- -----------------------------------------------------

-- Users can view properties they created or have shared access to
CREATE POLICY "Users can view own properties or shared properties"
  ON properties FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM shared_access
      WHERE property_id = properties.id
        AND user_id = auth.uid()
        AND can_view = true
    )
  );

-- Users can create properties
CREATE POLICY "Users can create properties"
  ON properties FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update properties they created or have edit access
CREATE POLICY "Users can update own properties or shared with edit"
  ON properties FOR UPDATE
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM shared_access
      WHERE property_id = properties.id
        AND user_id = auth.uid()
        AND can_edit = true
    )
  );

-- Users can delete properties they created or have delete access
CREATE POLICY "Users can delete own properties or shared with delete"
  ON properties FOR DELETE
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM shared_access
      WHERE property_id = properties.id
        AND user_id = auth.uid()
        AND can_delete = true
    )
  );

-- -----------------------------------------------------
-- Documents Policies
-- -----------------------------------------------------

-- Users can view documents for properties they have access to
CREATE POLICY "Users can view documents for accessible properties"
  ON documents FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = documents.property_id
        AND (
          properties.created_by = auth.uid()
          OR
          EXISTS (
            SELECT 1 FROM shared_access
            WHERE property_id = properties.id
              AND user_id = auth.uid()
              AND can_view = true
          )
        )
    )
  );

-- Users can upload documents to properties they own or have edit access
CREATE POLICY "Users can upload documents to accessible properties"
  ON documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = documents.property_id
        AND (
          properties.created_by = auth.uid()
          OR
          EXISTS (
            SELECT 1 FROM shared_access
            WHERE property_id = properties.id
              AND user_id = auth.uid()
              AND can_edit = true
          )
        )
    )
  );

-- Users can delete documents they uploaded
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (uploaded_by = auth.uid());

-- -----------------------------------------------------
-- Comps Policies
-- -----------------------------------------------------

-- Users can view comps for properties they have access to
CREATE POLICY "Users can view comps for accessible properties"
  ON comps FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = comps.property_id
        AND (
          properties.created_by = auth.uid()
          OR
          EXISTS (
            SELECT 1 FROM shared_access
            WHERE property_id = properties.id
              AND user_id = auth.uid()
              AND can_view = true
          )
        )
    )
  );

-- Users can add comps to accessible properties
CREATE POLICY "Users can add comps to accessible properties"
  ON comps FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = comps.property_id
        AND (
          properties.created_by = auth.uid()
          OR
          EXISTS (
            SELECT 1 FROM shared_access
            WHERE property_id = properties.id
              AND user_id = auth.uid()
              AND can_edit = true
          )
        )
    )
  );

-- Users can update/delete comps they created
CREATE POLICY "Users can update own comps"
  ON comps FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own comps"
  ON comps FOR DELETE
  USING (created_by = auth.uid());

-- -----------------------------------------------------
-- Deals Policies
-- -----------------------------------------------------

-- Users can view deals they created or have shared access to
CREATE POLICY "Users can view own deals or shared deals"
  ON deals FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM shared_access
      WHERE deal_id = deals.id
        AND user_id = auth.uid()
        AND can_view = true
    )
  );

-- Users can create deals
CREATE POLICY "Users can create deals"
  ON deals FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update/delete own deals
CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  USING (created_by = auth.uid());

-- -----------------------------------------------------
-- Shared Access Policies
-- -----------------------------------------------------

-- Users can view access records they created or that apply to them
CREATE POLICY "Users can view relevant shared access records"
  ON shared_access FOR SELECT
  USING (
    shared_by = auth.uid()
    OR user_id = auth.uid()
  );

-- Property/deal owners can share access
CREATE POLICY "Owners can share access"
  ON shared_access FOR INSERT
  WITH CHECK (
    shared_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM properties
        WHERE properties.id = shared_access.property_id
          AND properties.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM deals
        WHERE deals.id = shared_access.deal_id
          AND deals.created_by = auth.uid()
      )
    )
  );

-- Only the sharer can revoke access
CREATE POLICY "Sharers can revoke access"
  ON shared_access FOR DELETE
  USING (shared_by = auth.uid());

-- =====================================================
-- INITIAL DATA (Optional)
-- =====================================================

-- You can add seed data here if needed
-- Example: INSERT INTO profiles (id, email, full_name, role) VALUES (...);

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================
