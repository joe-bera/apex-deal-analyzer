-- Phase 4: Property Website Generator
-- Per-listing public landing pages with lead capture

-- ============================================================================
-- listing_sites: Published property listing pages
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,

  -- Publish state
  is_published BOOLEAN DEFAULT false,

  -- Custom overrides
  custom_headline TEXT,
  custom_description TEXT,
  template_style TEXT DEFAULT 'modern' CHECK (template_style IN ('modern', 'classic', 'minimal')),

  -- SEO
  seo_title TEXT,
  seo_description TEXT,

  -- Features
  lead_capture_email TEXT,
  virtual_tour_url TEXT,

  -- Linked generated documents (brochure/OM from Phase 2)
  brochure_doc_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
  om_doc_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL,

  -- Counters
  view_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,

  -- Ownership
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listing_sites_slug ON listing_sites(slug);
CREATE INDEX idx_listing_sites_property ON listing_sites(master_property_id);
CREATE INDEX idx_listing_sites_user ON listing_sites(created_by);

-- ============================================================================
-- listing_leads: Lead submissions from public listing pages
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_site_id UUID NOT NULL REFERENCES listing_sites(id) ON DELETE CASCADE,

  -- Lead info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  source TEXT DEFAULT 'listing_site',

  -- CRM linkage (no FK — contacts table may not exist yet; linked by backend logic)
  contact_id UUID,
  is_converted BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listing_leads_site ON listing_leads(listing_site_id);
CREATE INDEX idx_listing_leads_email ON listing_leads(email);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE listing_sites ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Users can read own listing sites"
  ON listing_sites FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own listing sites"
  ON listing_sites FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own listing sites"
  ON listing_sites FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own listing sites"
  ON listing_sites FOR DELETE
  USING (created_by = auth.uid());

-- Public can read published listing sites (for public endpoint)
CREATE POLICY "Public can read published listing sites"
  ON listing_sites FOR SELECT
  USING (is_published = true);

ALTER TABLE listing_leads ENABLE ROW LEVEL SECURITY;

-- Owner of listing site can read leads
CREATE POLICY "Listing owner can read leads"
  ON listing_leads FOR SELECT
  USING (
    listing_site_id IN (
      SELECT id FROM listing_sites WHERE created_by = auth.uid()
    )
  );

-- Public can insert leads (for lead form submissions)
CREATE POLICY "Public can submit leads"
  ON listing_leads FOR INSERT
  WITH CHECK (true);
