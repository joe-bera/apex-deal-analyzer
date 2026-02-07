-- CRM Tables Migration
-- Creates the CRM tables that were originally set up via Supabase dashboard.
-- Must run before email_campaigns (080000) and deal_room (090000) migrations.

-- ============================================================================
-- Enum Types
-- ============================================================================

CREATE TYPE contact_type AS ENUM (
  'owner', 'tenant', 'buyer', 'seller', 'broker', 'lender',
  'attorney', 'property_manager', 'investor', 'developer',
  'appraiser', 'contractor', 'other'
);

CREATE TYPE company_type AS ENUM (
  'brokerage', 'investment_firm', 'developer', 'tenant_company',
  'lender', 'law_firm', 'management_company', 'construction',
  'appraisal_firm', 'title_company', 'other'
);

CREATE TYPE crm_deal_type AS ENUM (
  'sale', 'lease', 'listing', 'acquisition', 'disposition'
);

CREATE TYPE deal_stage AS ENUM (
  'prospecting', 'qualification', 'proposal', 'negotiation',
  'under_contract', 'due_diligence', 'closing', 'closed_won', 'closed_lost'
);

CREATE TYPE activity_type AS ENUM (
  'call', 'email', 'meeting', 'note', 'task', 'site_visit',
  'document_sent', 'offer_made', 'other'
);

CREATE TYPE deal_role AS ENUM (
  'buyer', 'seller', 'listing_broker', 'buyers_broker', 'co_broker',
  'lender', 'attorney_buyer', 'attorney_seller', 'escrow_officer',
  'title_officer', 'appraiser', 'inspector', 'property_manager',
  'tenant', 'other'
);

-- ============================================================================
-- 1. Companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_type company_type NOT NULL DEFAULT 'other',
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_type ON companies(company_type);
CREATE INDEX idx_companies_created_by ON companies(created_by);
CREATE INDEX idx_companies_tags ON companies USING GIN(tags);

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT,
  contact_type contact_type NOT NULL DEFAULT 'other',
  license_number TEXT,
  source TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_type ON contacts(contact_type);
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_contacts_next_follow_up ON contacts(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. CRM Deals
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name TEXT NOT NULL,
  deal_type crm_deal_type NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'prospecting',
  description TEXT,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  master_property_id UUID REFERENCES master_properties(id) ON DELETE SET NULL,
  deal_value DECIMAL(15, 2),
  asking_price DECIMAL(15, 2),
  offer_price DECIMAL(15, 2),
  final_price DECIMAL(15, 2),
  commission_total DECIMAL(15, 2),
  commission_percent DECIMAL(5, 3),
  commission_split_percent DECIMAL(5, 2),
  commission_notes TEXT,
  expected_close_date DATE,
  actual_close_date DATE,
  listing_date DATE,
  expiration_date DATE,
  probability_percent INTEGER DEFAULT 50 CHECK (probability_percent >= 0 AND probability_percent <= 100),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_deals_stage ON crm_deals(stage);
CREATE INDEX idx_crm_deals_type ON crm_deals(deal_type);
CREATE INDEX idx_crm_deals_assigned ON crm_deals(assigned_to);
CREATE INDEX idx_crm_deals_created_by ON crm_deals(created_by);
CREATE INDEX idx_crm_deals_property ON crm_deals(property_id);
CREATE INDEX idx_crm_deals_master_property ON crm_deals(master_property_id);
CREATE INDEX idx_crm_deals_expected_close ON crm_deals(expected_close_date);

CREATE TRIGGER update_crm_deals_updated_at
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Deal Contacts (junction)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role deal_role NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, contact_id, role)
);

CREATE INDEX idx_deal_contacts_deal ON deal_contacts(deal_id);
CREATE INDEX idx_deal_contacts_contact ON deal_contacts(contact_id);

-- ============================================================================
-- 5. Contact Properties (junction)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  master_property_id UUID REFERENCES master_properties(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'other'
    CHECK (relationship IN ('owner', 'tenant', 'manager', 'broker', 'buyer', 'seller', 'lender', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (master_property_id IS NOT NULL OR property_id IS NOT NULL)
);

CREATE INDEX idx_contact_properties_contact ON contact_properties(contact_id);
CREATE INDEX idx_contact_properties_master ON contact_properties(master_property_id);
CREATE INDEX idx_contact_properties_property ON contact_properties(property_id);

-- ============================================================================
-- 6. Activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type activity_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  activity_date TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_activities_company ON activities(company_id);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activities_due_date ON activities(due_date) WHERE due_date IS NOT NULL AND is_completed = false;
CREATE INDEX idx_activities_activity_date ON activities(activity_date DESC);

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. Deal Stage History
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_deal_stage_history_deal ON deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_changed_at ON deal_stage_history(changed_at DESC);

-- ============================================================================
-- RLS Policies (permissive — backend uses supabaseAdmin)
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm_deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON deal_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON contact_properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON deal_stage_history FOR ALL USING (true) WITH CHECK (true);
