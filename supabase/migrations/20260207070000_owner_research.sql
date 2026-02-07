-- Phase 6: Owner Research / LLC Lookup
-- Creates owner_research table with enums and RLS policies

-- Entity type enum
CREATE TYPE owner_entity_type AS ENUM (
  'individual', 'llc', 'trust', 'corporation', 'reit',
  'partnership', 'government', 'nonprofit', 'unknown'
);

-- Research source enum
CREATE TYPE research_source AS ENUM (
  'ai', 'manual', 'county_records', 'other'
);

-- Owner Research table
CREATE TABLE owner_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  owner_name TEXT,
  owner_entity_type owner_entity_type DEFAULT 'unknown',
  registered_agent TEXT,
  mailing_address TEXT,
  phone TEXT,
  email TEXT,
  other_properties JSONB DEFAULT '[]'::jsonb,
  portfolio_estimate INT,
  research_source research_source NOT NULL DEFAULT 'manual',
  research_notes TEXT,
  ai_summary TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  researched_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_owner_research_property ON owner_research(master_property_id);
CREATE INDEX idx_owner_research_user ON owner_research(researched_by);
CREATE INDEX idx_owner_research_entity_type ON owner_research(owner_entity_type);

-- RLS
ALTER TABLE owner_research ENABLE ROW LEVEL SECURITY;

-- Users can read their own research
CREATE POLICY "Users can view own research"
  ON owner_research FOR SELECT
  USING (auth.uid() = researched_by);

-- Users can insert their own research
CREATE POLICY "Users can create research"
  ON owner_research FOR INSERT
  WITH CHECK (auth.uid() = researched_by);

-- Users can update their own research
CREATE POLICY "Users can update own research"
  ON owner_research FOR UPDATE
  USING (auth.uid() = researched_by);

-- Users can delete their own research
CREATE POLICY "Users can delete own research"
  ON owner_research FOR DELETE
  USING (auth.uid() = researched_by);

-- Service role bypass (for backend API)
CREATE POLICY "Service role full access"
  ON owner_research FOR ALL
  USING (auth.role() = 'service_role');
