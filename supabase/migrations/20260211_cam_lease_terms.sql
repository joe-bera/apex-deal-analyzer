-- CAM Reconciliation Enhancement: Lease Terms + Detailed Breakdowns
-- Adds tenant_lease_terms table and detail columns to cam_reconciliation_items/cam_reconciliations

-- New enum for CAM cap types
DO $$ BEGIN
  CREATE TYPE cam_cap_type AS ENUM ('none', 'cumulative', 'compounded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- tenant_lease_terms: per-tenant CAM provisions from lease
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_lease_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cam_cap_type cam_cap_type DEFAULT 'none',
  cam_cap_percent NUMERIC(5,2),
  cam_cap_base_amount NUMERIC(12,2),
  base_year INTEGER,
  base_year_amount NUMERIC(12,2),
  expense_stop_amount NUMERIC(12,2),
  expense_stop_per_sf BOOLEAN DEFAULT false,
  has_gross_up BOOLEAN DEFAULT false,
  gross_up_occupancy_threshold NUMERIC(5,2),
  admin_fee_percent NUMERIC(5,2),
  excluded_categories TEXT[],
  proration_start DATE,
  proration_end DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_tenant_lease_terms UNIQUE (tenant_id)
);

-- Index for fast lookup by tenant
CREATE INDEX IF NOT EXISTS idx_tenant_lease_terms_tenant ON tenant_lease_terms(tenant_id);

-- Updated-at trigger
CREATE OR REPLACE TRIGGER set_tenant_lease_terms_updated_at
  BEFORE UPDATE ON tenant_lease_terms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Enhance cam_reconciliation_items with detailed breakdown columns
-- ============================================================================
ALTER TABLE cam_reconciliation_items
  ADD COLUMN IF NOT EXISTS pre_cap_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cam_cap_applied NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS base_year_credit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS expense_stop_credit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS gross_up_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS proration_factor NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS excluded_amount NUMERIC(12,2);

-- ============================================================================
-- Enhance cam_reconciliations with summary columns
-- ============================================================================
ALTER TABLE cam_reconciliations
  ADD COLUMN IF NOT EXISTS total_gross_up NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS grossed_up_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS building_total_sf NUMERIC(10,2);

-- ============================================================================
-- RLS policies for tenant_lease_terms
-- ============================================================================
ALTER TABLE tenant_lease_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tenant_lease_terms"
  ON tenant_lease_terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tenant_lease_terms"
  ON tenant_lease_terms FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tenant_lease_terms"
  ON tenant_lease_terms FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tenant_lease_terms"
  ON tenant_lease_terms FOR DELETE
  TO authenticated
  USING (true);
