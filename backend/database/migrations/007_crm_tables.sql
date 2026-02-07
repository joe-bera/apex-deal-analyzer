-- ============================================================================
-- Migration 007: CRM Foundation Tables
-- ============================================================================
-- Creates the CRM backbone: Companies, Contacts, CRM Deals, Activities,
-- and junction tables for linking contacts to deals and properties.
-- Also includes deal stage history tracking with auto-trigger.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Enums
-- ============================================================================

CREATE TYPE contact_type AS ENUM (
  'owner',
  'tenant',
  'buyer',
  'seller',
  'broker',
  'lender',
  'attorney',
  'property_manager',
  'investor',
  'developer',
  'appraiser',
  'contractor',
  'other'
);

CREATE TYPE company_type AS ENUM (
  'brokerage',
  'investment_firm',
  'developer',
  'tenant_company',
  'lender',
  'law_firm',
  'management_company',
  'construction',
  'appraisal_firm',
  'title_company',
  'other'
);

CREATE TYPE crm_deal_type AS ENUM (
  'sale',
  'lease',
  'listing',
  'acquisition',
  'disposition'
);

CREATE TYPE deal_stage AS ENUM (
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'under_contract',
  'due_diligence',
  'closing',
  'closed_won',
  'closed_lost'
);

CREATE TYPE activity_type AS ENUM (
  'call',
  'email',
  'meeting',
  'note',
  'task',
  'site_visit',
  'document_sent',
  'offer_made',
  'other'
);

CREATE TYPE deal_role AS ENUM (
  'buyer',
  'seller',
  'listing_broker',
  'buyers_broker',
  'co_broker',
  'lender',
  'attorney_buyer',
  'attorney_seller',
  'escrow_officer',
  'title_officer',
  'appraiser',
  'inspector',
  'property_manager',
  'tenant',
  'other'
);

-- ============================================================================
-- STEP 2: Create Companies Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Company Info
  name TEXT NOT NULL,
  company_type company_type NOT NULL DEFAULT 'other',
  industry TEXT,
  website TEXT,

  -- Contact Info
  phone TEXT,
  email TEXT,

  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,

  -- Categorization
  tags TEXT[] DEFAULT '{}',
  notes TEXT,

  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_type ON companies(company_type);
CREATE INDEX idx_companies_created_by ON companies(created_by);
CREATE INDEX idx_companies_tags ON companies USING GIN(tags);

-- Updated_at trigger
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 3: Create Contacts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Name
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,

  -- Contact Info
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,

  -- Company Link
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT,

  -- Classification
  contact_type contact_type NOT NULL DEFAULT 'other',
  license_number TEXT,
  source TEXT,

  -- Follow-up Tracking
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,

  -- Categorization
  tags TEXT[] DEFAULT '{}',
  notes TEXT,

  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_type ON contacts(contact_type);
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_contacts_next_follow_up ON contacts(next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- Updated_at trigger
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 4: Create CRM Deals Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Deal Info
  deal_name TEXT NOT NULL,
  deal_type crm_deal_type NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'prospecting',
  description TEXT,

  -- Property Links (optional - a deal may reference either or both)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  master_property_id UUID REFERENCES master_properties(id) ON DELETE SET NULL,

  -- Financials
  deal_value DECIMAL(15, 2),
  asking_price DECIMAL(15, 2),
  offer_price DECIMAL(15, 2),
  final_price DECIMAL(15, 2),

  -- Commission
  commission_total DECIMAL(15, 2),
  commission_percent DECIMAL(5, 3),
  commission_split_percent DECIMAL(5, 2),
  commission_notes TEXT,

  -- Timeline
  expected_close_date DATE,
  actual_close_date DATE,
  listing_date DATE,
  expiration_date DATE,

  -- Probability & Priority
  probability_percent INTEGER DEFAULT 50 CHECK (probability_percent >= 0 AND probability_percent <= 100),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Stage tracking
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_crm_deals_stage ON crm_deals(stage);
CREATE INDEX idx_crm_deals_type ON crm_deals(deal_type);
CREATE INDEX idx_crm_deals_assigned ON crm_deals(assigned_to);
CREATE INDEX idx_crm_deals_created_by ON crm_deals(created_by);
CREATE INDEX idx_crm_deals_property ON crm_deals(property_id);
CREATE INDEX idx_crm_deals_master_property ON crm_deals(master_property_id);
CREATE INDEX idx_crm_deals_expected_close ON crm_deals(expected_close_date);
CREATE INDEX idx_crm_deals_priority ON crm_deals(priority);

-- Updated_at trigger
CREATE TRIGGER update_crm_deals_updated_at
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Create Deal Contacts Junction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role deal_role NOT NULL DEFAULT 'other',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(deal_id, contact_id, role)
);

-- Indexes
CREATE INDEX idx_deal_contacts_deal ON deal_contacts(deal_id);
CREATE INDEX idx_deal_contacts_contact ON deal_contacts(contact_id);

-- ============================================================================
-- STEP 6: Create Contact Properties Junction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  master_property_id UUID REFERENCES master_properties(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  relationship TEXT NOT NULL DEFAULT 'other'
    CHECK (relationship IN ('owner', 'tenant', 'manager', 'broker', 'buyer', 'seller', 'lender', 'other')),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Must link to at least one property
  CHECK (master_property_id IS NOT NULL OR property_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_contact_properties_contact ON contact_properties(contact_id);
CREATE INDEX idx_contact_properties_master ON contact_properties(master_property_id);
CREATE INDEX idx_contact_properties_property ON contact_properties(property_id);

-- ============================================================================
-- STEP 7: Create Activities Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Activity Details
  activity_type activity_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,

  -- Linked Entities (all optional, at least one should be set in practice)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

  -- Task-specific fields
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,

  -- When the activity occurred (vs when it was logged)
  activity_date TIMESTAMPTZ DEFAULT NOW(),

  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_activities_company ON activities(company_id);
CREATE INDEX idx_activities_property ON activities(property_id);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activities_due_date ON activities(due_date)
  WHERE due_date IS NOT NULL AND is_completed = false;
CREATE INDEX idx_activities_activity_date ON activities(activity_date DESC);

-- Updated_at trigger
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 8: Create Deal Stage History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,

  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_deal_stage_history_deal ON deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_changed_at ON deal_stage_history(changed_at DESC);

-- ============================================================================
-- STEP 9: Deal Stage Change Trigger
-- ============================================================================
-- Automatically records stage transitions and updates stage_entered_at

CREATE OR REPLACE FUNCTION record_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    -- Record the transition
    INSERT INTO deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, NEW.created_by);

    -- Update stage_entered_at
    NEW.stage_entered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deal_stage_change
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION record_deal_stage_change();

-- ============================================================================
-- STEP 10: Row Level Security
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

-- ---- Companies ----

CREATE POLICY "Admins can view all companies" ON companies
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view own companies" ON companies
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert companies" ON companies
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update all companies" ON companies
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can update own companies" ON companies
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete all companies" ON companies
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can delete own companies" ON companies
  FOR DELETE
  USING (created_by = auth.uid());

-- ---- Contacts ----

CREATE POLICY "Admins can view all contacts" ON contacts
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view own contacts" ON contacts
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert contacts" ON contacts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update all contacts" ON contacts
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can update own contacts" ON contacts
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete all contacts" ON contacts
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can delete own contacts" ON contacts
  FOR DELETE
  USING (created_by = auth.uid());

-- ---- CRM Deals ----

CREATE POLICY "Admins can view all crm deals" ON crm_deals
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view own crm deals" ON crm_deals
  FOR SELECT
  USING (created_by = auth.uid());

-- Also let assigned users see their deals
CREATE POLICY "Assigned users can view crm deals" ON crm_deals
  FOR SELECT
  USING (assigned_to = auth.uid());

CREATE POLICY "Users can insert crm deals" ON crm_deals
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update all crm deals" ON crm_deals
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can update own crm deals" ON crm_deals
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Assigned users can update crm deals" ON crm_deals
  FOR UPDATE
  USING (assigned_to = auth.uid());

CREATE POLICY "Admins can delete all crm deals" ON crm_deals
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can delete own crm deals" ON crm_deals
  FOR DELETE
  USING (created_by = auth.uid());

-- ---- Deal Contacts (follows deal access) ----

CREATE POLICY "Users can view deal contacts for accessible deals" ON deal_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_deals
      WHERE crm_deals.id = deal_contacts.deal_id
        AND (
          crm_deals.created_by = auth.uid()
          OR crm_deals.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    )
  );

CREATE POLICY "Users can insert deal contacts for accessible deals" ON deal_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_deals
      WHERE crm_deals.id = deal_contacts.deal_id
        AND (
          crm_deals.created_by = auth.uid()
          OR crm_deals.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    )
  );

CREATE POLICY "Users can delete deal contacts for accessible deals" ON deal_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM crm_deals
      WHERE crm_deals.id = deal_contacts.deal_id
        AND (
          crm_deals.created_by = auth.uid()
          OR crm_deals.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    )
  );

-- ---- Contact Properties ----

CREATE POLICY "Admins can view all contact properties" ON contact_properties
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view contact properties for own contacts" ON contact_properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_properties.contact_id
        AND contacts.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert contact properties" ON contact_properties
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete contact properties for own contacts" ON contact_properties
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_properties.contact_id
        AND (
          contacts.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    )
  );

-- ---- Activities ----

CREATE POLICY "Admins can view all activities" ON activities
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can view own activities" ON activities
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert activities" ON activities
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update all activities" ON activities
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can update own activities" ON activities
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete all activities" ON activities
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Members can delete own activities" ON activities
  FOR DELETE
  USING (created_by = auth.uid());

-- ---- Deal Stage History (read-only for deal participants) ----

CREATE POLICY "Admins can view all stage history" ON deal_stage_history
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can view stage history for accessible deals" ON deal_stage_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_deals
      WHERE crm_deals.id = deal_stage_history.deal_id
        AND (crm_deals.created_by = auth.uid() OR crm_deals.assigned_to = auth.uid())
    )
  );

-- Insert is handled by trigger, but allow manual inserts for stage notes
CREATE POLICY "Users can insert stage history for accessible deals" ON deal_stage_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_deals
      WHERE crm_deals.id = deal_stage_history.deal_id
        AND (
          crm_deals.created_by = auth.uid()
          OR crm_deals.assigned_to = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    )
  );

-- ============================================================================
-- Done! CRM Foundation tables are ready.
-- ============================================================================
