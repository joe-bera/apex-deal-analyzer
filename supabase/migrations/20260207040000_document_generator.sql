-- Phase 2: Brochure / OM / Proposal Generator
-- Tables for AI-generated content caching and document tracking

-- ============================================================================
-- generated_content: Caches AI-generated text sections per property
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'property_description',
    'executive_summary',
    'location_analysis',
    'property_highlights',
    'market_analysis',
    'team_intro'
  )),
  prompt_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one cached result per property + content_type + prompt_hash
  UNIQUE (master_property_id, content_type, prompt_hash)
);

-- Index for fast lookups
CREATE INDEX idx_generated_content_property ON generated_content(master_property_id);
CREATE INDEX idx_generated_content_lookup ON generated_content(master_property_id, content_type, prompt_hash);

-- ============================================================================
-- generated_documents: Tracks saved/exported PDF documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID REFERENCES master_properties(id) ON DELETE SET NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('brochure', 'om', 'proposal')),
  title TEXT NOT NULL,
  file_url TEXT,
  content_snapshot JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_generated_documents_property ON generated_documents(master_property_id);
CREATE INDEX idx_generated_documents_user ON generated_documents(created_by);

-- ============================================================================
-- Storage bucket for generated documents
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-documents', 'generated-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for generated_content
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own generated content"
  ON generated_content FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own generated content"
  ON generated_content FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own generated content"
  ON generated_content FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own generated content"
  ON generated_content FOR DELETE
  USING (created_by = auth.uid());

-- RLS policies for generated_documents
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own generated documents"
  ON generated_documents FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own generated documents"
  ON generated_documents FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own generated documents"
  ON generated_documents FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own generated documents"
  ON generated_documents FOR DELETE
  USING (created_by = auth.uid());
