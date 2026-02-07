-- Phase 10: Listing Syndication
-- Allows publishing listings to external CRE platforms (Crexi, LoopNet, Brevitas, etc.)

-- ============================================================================
-- 1. syndication_platforms - registry of external platforms
-- ============================================================================
CREATE TABLE IF NOT EXISTS syndication_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  integration_type TEXT NOT NULL DEFAULT 'manual' CHECK (integration_type IN ('api', 'csv_export', 'manual')),
  api_base_url TEXT,
  field_mapping JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. syndication_listings - a property published to a platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS syndication_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_site_id UUID NOT NULL REFERENCES listing_sites(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES syndication_platforms(id),
  external_listing_id TEXT,
  external_listing_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'synced', 'error', 'delisted')),
  published_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  sync_data JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. syndication_activity_log - audit trail for syndication actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS syndication_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndication_listing_id UUID NOT NULL REFERENCES syndication_listings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_syndication_listings_listing_site ON syndication_listings(listing_site_id);
CREATE INDEX IF NOT EXISTS idx_syndication_listings_platform ON syndication_listings(platform_id);
CREATE INDEX IF NOT EXISTS idx_syndication_listings_status ON syndication_listings(status);
CREATE INDEX IF NOT EXISTS idx_syndication_activity_log_listing ON syndication_activity_log(syndication_listing_id);

-- ============================================================================
-- RLS (permissive — backend uses supabaseAdmin)
-- ============================================================================
ALTER TABLE syndication_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndication_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndication_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON syndication_platforms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON syndication_listings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON syndication_activity_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Seed platforms
-- ============================================================================
INSERT INTO syndication_platforms (name, display_name, logo_url, website_url, integration_type, api_base_url, field_mapping) VALUES
(
  'crexi',
  'Crexi',
  NULL,
  'https://www.crexi.com',
  'api',
  'https://api.crexi.com/v1',
  '{
    "address": "property_address",
    "city": "property_city",
    "state": "property_state",
    "zip": "property_zip",
    "building_size": "square_footage",
    "lot_size_acres": "lot_size",
    "property_type": "asset_type",
    "year_built": "year_built",
    "price": "asking_price",
    "cap_rate": "cap_rate",
    "description": "description"
  }'::jsonb
),
(
  'loopnet',
  'LoopNet / CoStar',
  NULL,
  'https://www.loopnet.com',
  'csv_export',
  NULL,
  '{
    "address": "Street Address",
    "city": "City",
    "state": "State",
    "zip": "Zip Code",
    "building_size": "Building Size (SF)",
    "lot_size_acres": "Lot Size (Acres)",
    "property_type": "Property Type",
    "property_subtype": "Property Subtype",
    "year_built": "Year Built",
    "price": "Asking Price",
    "cap_rate": "Cap Rate (%)",
    "noi": "NOI",
    "description": "Description",
    "clear_height_ft": "Clear Height (ft)",
    "dock_doors": "Dock Doors",
    "grade_doors": "Grade Level Doors"
  }'::jsonb
),
(
  'brevitas',
  'Brevitas',
  NULL,
  'https://www.brevitas.com',
  'api',
  'https://api.brevitas.com',
  '{
    "address": "address",
    "city": "city",
    "state": "state",
    "zip": "postal_code",
    "building_size": "building_sf",
    "property_type": "property_type",
    "year_built": "year_built",
    "price": "price",
    "cap_rate": "cap_rate",
    "description": "description"
  }'::jsonb
),
(
  'commercialcafe',
  'CommercialCafe',
  NULL,
  'https://www.commercialcafe.com',
  'manual',
  NULL,
  '{
    "address": "address",
    "city": "city",
    "state": "state",
    "zip": "zip",
    "building_size": "size_sqft",
    "property_type": "type",
    "price": "price",
    "description": "description"
  }'::jsonb
),
(
  'tenantbase',
  'TenantBase',
  NULL,
  'https://www.tenantbase.com',
  'manual',
  NULL,
  '{
    "address": "address",
    "city": "city",
    "state": "state",
    "zip": "zip",
    "building_size": "available_sf",
    "property_type": "space_type",
    "price": "asking_rate",
    "description": "description"
  }'::jsonb
),
(
  'officespace',
  'OfficeSpace',
  NULL,
  'https://www.officespace.com',
  'manual',
  NULL,
  '{
    "address": "address",
    "city": "city",
    "state": "state",
    "zip": "zip_code",
    "building_size": "total_sf",
    "property_type": "property_type",
    "price": "asking_price",
    "description": "description"
  }'::jsonb
);
