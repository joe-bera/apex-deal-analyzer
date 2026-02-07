-- Phase 9: Deal Room + Task Playbooks
-- 6 new tables + seed data for pre-built playbooks

-- ============================================================================
-- Deal Room Documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_room_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  category TEXT DEFAULT 'other',
  description TEXT,
  is_visible_to_external BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_room_documents_deal_id ON deal_room_documents(deal_id);

-- ============================================================================
-- Deal Room Invites (external party access tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_room_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  access_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX idx_deal_room_invites_deal_id ON deal_room_invites(deal_id);
CREATE INDEX idx_deal_room_invites_token ON deal_room_invites(access_token);

-- ============================================================================
-- Deal Room Activity Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_room_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  document_id UUID REFERENCES deal_room_documents(id) ON DELETE SET NULL,
  invite_id UUID REFERENCES deal_room_invites(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_room_activity_log_deal_id ON deal_room_activity_log(deal_id);

-- ============================================================================
-- Task Playbooks (reusable templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  deal_type TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Playbook Task Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS playbook_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES task_playbooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT,
  due_offset_days INTEGER,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_playbook_tasks_playbook_id ON playbook_tasks(playbook_id);

-- ============================================================================
-- Deal Tasks (instances created from playbooks or manually)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  playbook_id UUID REFERENCES task_playbooks(id),
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT,
  assigned_to UUID REFERENCES profiles(id),
  due_date TIMESTAMPTZ,
  is_required BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_tasks_deal_id ON deal_tasks(deal_id);

-- ============================================================================
-- Seed: Pre-built Playbooks
-- ============================================================================

-- Sale Transaction Playbook
INSERT INTO task_playbooks (id, name, description, deal_type, is_default)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Sale Transaction',
  'Standard checklist for commercial property sale transactions',
  'sale',
  true
);

INSERT INTO playbook_tasks (playbook_id, title, description, stage, due_offset_days, is_required, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Review LOI', 'Review and negotiate Letter of Intent terms', 'negotiation', 3, true, 1),
  ('a0000000-0000-0000-0000-000000000001', 'PSA Negotiation', 'Draft and negotiate Purchase & Sale Agreement', 'under_contract', 7, true, 2),
  ('a0000000-0000-0000-0000-000000000001', 'Title Search', 'Order and review preliminary title report', 'due_diligence', 14, true, 3),
  ('a0000000-0000-0000-0000-000000000001', 'Due Diligence Review', 'Complete property inspections, environmental, and financial review', 'due_diligence', 21, true, 4),
  ('a0000000-0000-0000-0000-000000000001', 'Appraisal', 'Order and review property appraisal', 'due_diligence', 28, false, 5),
  ('a0000000-0000-0000-0000-000000000001', 'Closing Documents', 'Prepare and review all closing documents', 'closing', 35, true, 6),
  ('a0000000-0000-0000-0000-000000000001', 'Recording & Close', 'Record deed and finalize transaction', 'closing', 42, true, 7);

-- Lease Transaction Playbook
INSERT INTO task_playbooks (id, name, description, deal_type, is_default)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'Lease Transaction',
  'Standard checklist for commercial lease transactions',
  'lease',
  true
);

INSERT INTO playbook_tasks (playbook_id, title, description, stage, due_offset_days, is_required, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'LOI / Proposal', 'Draft and submit Letter of Intent for lease terms', 'proposal', 3, true, 1),
  ('a0000000-0000-0000-0000-000000000002', 'Lease Draft Review', 'Review and negotiate lease agreement terms', 'negotiation', 10, true, 2),
  ('a0000000-0000-0000-0000-000000000002', 'Tenant Improvements', 'Negotiate TI allowance and improvement plans', 'negotiation', 14, false, 3),
  ('a0000000-0000-0000-0000-000000000002', 'Lease Execution', 'Finalize and execute the lease agreement', 'closing', 21, true, 4),
  ('a0000000-0000-0000-0000-000000000002', 'Move-In Coordination', 'Coordinate tenant move-in and space handoff', 'closing', 30, false, 5);

-- Listing Playbook
INSERT INTO task_playbooks (id, name, description, deal_type, is_default)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'Listing',
  'Standard checklist for new property listings',
  'listing',
  true
);

INSERT INTO playbook_tasks (playbook_id, title, description, stage, due_offset_days, is_required, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'Listing Agreement', 'Execute listing agreement with property owner', 'prospecting', 1, true, 1),
  ('a0000000-0000-0000-0000-000000000003', 'Photos & Marketing', 'Schedule professional photography and create marketing materials', 'qualification', 5, true, 2),
  ('a0000000-0000-0000-0000-000000000003', 'Showing Schedule', 'Set up showing schedule and coordinate property access', 'qualification', 7, false, 3),
  ('a0000000-0000-0000-0000-000000000003', 'Offer Review', 'Review incoming offers and present to owner', 'negotiation', 14, true, 4),
  ('a0000000-0000-0000-0000-000000000003', 'Negotiation & Accept', 'Negotiate best terms and facilitate offer acceptance', 'negotiation', 21, true, 5);

-- Enable RLS
ALTER TABLE deal_room_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_tasks ENABLE ROW LEVEL SECURITY;

-- Permissive policies (service role bypasses RLS, app uses supabaseAdmin)
CREATE POLICY "Allow all for authenticated" ON deal_room_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON deal_room_invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON deal_room_activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON task_playbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON playbook_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON deal_tasks FOR ALL USING (true) WITH CHECK (true);
