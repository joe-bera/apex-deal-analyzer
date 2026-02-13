-- Executive Summaries: persist generated PDF files per property
CREATE TABLE IF NOT EXISTS executive_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  owner_name TEXT NOT NULL,
  honorific TEXT DEFAULT 'Mr.',
  entity_name TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by property
CREATE INDEX idx_exec_summaries_property ON executive_summaries(property_id);
CREATE INDEX idx_exec_summaries_created ON executive_summaries(created_at DESC);

-- RLS
ALTER TABLE executive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read executive summaries"
ON executive_summaries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert executive summaries"
ON executive_summaries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete own executive summaries"
ON executive_summaries FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Storage bucket for executive summary PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('executive-summaries', 'executive-summaries', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload executive summaries"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'executive-summaries');

CREATE POLICY "Public read access for executive summaries"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'executive-summaries');

CREATE POLICY "Authenticated users can delete executive summaries"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'executive-summaries');
