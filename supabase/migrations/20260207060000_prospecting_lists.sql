-- Phase 5: Prospecting Lists with Segmentation
-- Two tables: prospect_lists (saved filter configurations) and prospect_list_items (snapshot results)

-- prospect_lists: stores saved filter queries and metadata
CREATE TABLE prospect_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  result_count INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- prospect_list_items: materialized snapshot of filter results
CREATE TYPE prospect_item_status AS ENUM ('pending', 'contacted', 'qualified', 'not_interested');

CREATE TABLE prospect_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES prospect_lists(id) ON DELETE CASCADE,
  master_property_id UUID NOT NULL REFERENCES master_properties(id),
  status prospect_item_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prospect_lists_created_by ON prospect_lists(created_by);
CREATE INDEX idx_prospect_list_items_list_id ON prospect_list_items(list_id);
CREATE INDEX idx_prospect_list_items_property ON prospect_list_items(master_property_id);
CREATE INDEX idx_prospect_list_items_status ON prospect_list_items(status);

-- RLS
ALTER TABLE prospect_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_list_items ENABLE ROW LEVEL SECURITY;

-- prospect_lists: users can CRUD their own lists
CREATE POLICY "Users can view own prospect lists"
  ON prospect_lists FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create prospect lists"
  ON prospect_lists FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own prospect lists"
  ON prospect_lists FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own prospect lists"
  ON prospect_lists FOR DELETE
  USING (auth.uid() = created_by);

-- prospect_list_items: users can CRUD items in their own lists
CREATE POLICY "Users can view items in own lists"
  ON prospect_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM prospect_lists WHERE id = prospect_list_items.list_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can add items to own lists"
  ON prospect_list_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM prospect_lists WHERE id = prospect_list_items.list_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can update items in own lists"
  ON prospect_list_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM prospect_lists WHERE id = prospect_list_items.list_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can delete items from own lists"
  ON prospect_list_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM prospect_lists WHERE id = prospect_list_items.list_id AND created_by = auth.uid()
  ));

-- Service role bypass for backend operations
CREATE POLICY "Service role full access to prospect_lists"
  ON prospect_lists FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to prospect_list_items"
  ON prospect_list_items FOR ALL
  USING (auth.role() = 'service_role');
