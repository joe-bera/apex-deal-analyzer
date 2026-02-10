-- ============================================================================
-- Phase 11: Asset Services / Property Management
-- Migration: 20260209120000_asset_services.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Enums
-- ============================================================================

CREATE TYPE management_tier AS ENUM ('asset_management', 'asset_oversight', 'asset_monitoring');
CREATE TYPE lease_type AS ENUM ('gross', 'modified_gross', 'nnn', 'nn', 'percentage', 'month_to_month', 'ground');
CREATE TYPE expense_category AS ENUM (
  'property_tax', 'insurance', 'utilities_water', 'utilities_electric',
  'utilities_gas', 'utilities_trash', 'maintenance_repair', 'landscaping',
  'janitorial', 'security', 'management_fee', 'legal', 'accounting',
  'marketing', 'capital_improvement', 'pest_control', 'hvac',
  'roof_repair', 'parking_lot', 'signage', 'other'
);
CREATE TYPE cam_allocation_method AS ENUM ('pro_rata_sf', 'equal_share', 'fixed_amount', 'custom_percentage');
CREATE TYPE inspection_type AS ENUM ('routine', 'move_in', 'move_out', 'annual', 'emergency', 'insurance');
CREATE TYPE condition_severity AS ENUM ('cosmetic', 'minor', 'moderate', 'major', 'critical');
CREATE TYPE condition_status AS ENUM ('identified', 'scheduled', 'in_progress', 'completed', 'deferred');
CREATE TYPE work_order_status AS ENUM ('open', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE work_order_priority AS ENUM ('low', 'medium', 'high', 'emergency');
CREATE TYPE capital_project_status AS ENUM ('proposed', 'approved', 'in_progress', 'completed', 'cancelled');
CREATE TYPE compliance_item_type AS ENUM (
  'fire_inspection', 'elevator_cert', 'backflow_test', 'roof_warranty',
  'insurance_renewal', 'tax_filing', 'business_license', 'ada_compliance',
  'environmental', 'hvac_service', 'pest_control_service', 'other'
);
CREATE TYPE payment_status AS ENUM ('expected', 'received', 'late', 'partial', 'waived');
CREATE TYPE reconciliation_period AS ENUM ('monthly', 'quarterly', 'annual');

-- ============================================================================
-- STEP 2: Add management columns to master_properties
-- ============================================================================

ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT false;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS management_tier management_tier;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS management_fee_percent NUMERIC(5,2);
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS management_start_date DATE;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS management_end_date DATE;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS management_agreement_url TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS management_notes TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS owner_contact_id UUID REFERENCES contacts(id);

-- ============================================================================
-- STEP 3: Recreate property_with_latest_transaction view
-- ============================================================================

DROP VIEW IF EXISTS property_with_latest_transaction;

CREATE VIEW property_with_latest_transaction AS
SELECT
  mp.*,
  t.transaction_type AS latest_transaction_type,
  t.transaction_date AS latest_transaction_date,
  t.sale_price AS latest_sale_price,
  t.price_per_sf AS latest_price_per_sf,
  t.cap_rate AS latest_cap_rate
FROM master_properties mp
LEFT JOIN LATERAL (
  SELECT * FROM transactions
  WHERE property_id = mp.id
  ORDER BY COALESCE(transaction_date, created_at) DESC
  LIMIT 1
) t ON true
WHERE mp.is_deleted = false;

-- ============================================================================
-- STEP 4: Expand role constraint on profiles
-- ============================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'broker', 'owner', 'investor', 'tenant', 'member'));

-- ============================================================================
-- STEP 5: Create new tables
-- ============================================================================

-- 1. Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  trade TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  license_number TEXT,
  insurance_expiry DATE,
  w9_on_file BOOLEAN DEFAULT false,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_preferred BOOLEAN DEFAULT false,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  unit_number TEXT,
  tenant_name TEXT NOT NULL,
  lease_type lease_type,
  lease_start DATE,
  lease_end DATE,
  monthly_base_rent NUMERIC(12,2),
  rent_per_sf NUMERIC(8,2),
  leased_sf NUMERIC(10,2),
  security_deposit NUMERIC(12,2),
  cam_share_percent NUMERIC(6,4),
  cam_share_sf NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Rent Payments
CREATE TABLE rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  amount_due NUMERIC(12,2),
  amount_paid NUMERIC(12,2),
  payment_date DATE,
  payment_status payment_status DEFAULT 'expected',
  payment_method TEXT,
  reference_number TEXT,
  late_fee NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Operating Expenses
CREATE TABLE operating_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  category expense_category,
  description TEXT,
  amount NUMERIC(12,2),
  expense_date DATE,
  vendor_id UUID REFERENCES vendors(id),
  is_cam_recoverable BOOLEAN DEFAULT false,
  receipt_url TEXT,
  receipt_file_name TEXT,
  ai_categorized BOOLEAN DEFAULT false,
  ai_confidence NUMERIC(5,4),
  batch_upload_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. CAM Reconciliations
CREATE TABLE cam_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  period reconciliation_period,
  period_start DATE,
  period_end DATE,
  total_cam_expenses NUMERIC(12,2),
  total_collected NUMERIC(12,2),
  variance NUMERIC(12,2),
  allocation_method cam_allocation_method DEFAULT 'pro_rata_sf',
  is_finalized BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. CAM Reconciliation Items
CREATE TABLE cam_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES cam_reconciliations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  share_percent NUMERIC(6,4),
  allocated_amount NUMERIC(12,2),
  amount_paid NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2),
  notes TEXT
);

-- 7. Property Budgets
CREATE TABLE property_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  total_budget NUMERIC(14,2),
  is_approved BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Budget Line Items
CREATE TABLE budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES property_budgets(id) ON DELETE CASCADE,
  category expense_category,
  budgeted_amount NUMERIC(12,2),
  actual_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT
);

-- 9. Inspections
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  inspection_type inspection_type,
  inspection_date DATE,
  inspector_name TEXT,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  summary TEXT,
  photos_url TEXT[],
  report_url TEXT,
  next_inspection_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Condition Items
CREATE TABLE condition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  location TEXT,
  description TEXT,
  severity condition_severity,
  status condition_status DEFAULT 'identified',
  photo_urls TEXT[],
  estimated_cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Work Orders
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  vendor_id UUID REFERENCES vendors(id),
  condition_item_id UUID REFERENCES condition_items(id),
  title TEXT NOT NULL,
  description TEXT,
  priority work_order_priority DEFAULT 'medium',
  status work_order_status DEFAULT 'open',
  category expense_category,
  estimated_cost NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  scheduled_date DATE,
  completed_date DATE,
  completed_by TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add work_order_id FK to condition_items now that work_orders exists
ALTER TABLE condition_items ADD COLUMN work_order_id UUID REFERENCES work_orders(id);

-- 12. Capital Projects
CREATE TABLE capital_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status capital_project_status DEFAULT 'proposed',
  estimated_cost NUMERIC(14,2),
  actual_cost NUMERIC(14,2),
  start_date DATE,
  target_completion DATE,
  actual_completion DATE,
  vendor_id UUID REFERENCES vendors(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Compliance Items
CREATE TABLE compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_property_id UUID NOT NULL REFERENCES master_properties(id) ON DELETE CASCADE,
  item_type compliance_item_type,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_date DATE,
  is_recurring BOOLEAN DEFAULT true,
  recurrence_months INTEGER,
  vendor_id UUID REFERENCES vendors(id),
  document_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 6: Create Views
-- ============================================================================

-- Rent Roll view
CREATE VIEW rent_roll AS
SELECT
  t.id AS tenant_id,
  t.master_property_id,
  t.unit_number,
  t.tenant_name,
  t.lease_type,
  t.lease_start,
  t.lease_end,
  t.monthly_base_rent,
  t.rent_per_sf,
  t.leased_sf,
  t.security_deposit,
  t.cam_share_percent,
  t.cam_share_sf,
  t.is_active,
  mp.address AS property_address,
  mp.city AS property_city,
  mp.building_size AS total_building_sf,
  CASE WHEN mp.building_size > 0 AND t.leased_sf > 0
    THEN ROUND((t.leased_sf / mp.building_size * 100)::NUMERIC, 2)
    ELSE 0
  END AS percent_of_building,
  t.monthly_base_rent * 12 AS annual_rent
FROM tenants t
JOIN master_properties mp ON mp.id = t.master_property_id
WHERE t.is_active = true;

-- Managed Properties Summary view
CREATE VIEW managed_properties_summary AS
SELECT
  mp.id,
  mp.address,
  mp.city,
  mp.state,
  mp.property_type,
  mp.building_size,
  mp.management_tier,
  mp.management_fee_percent,
  mp.management_start_date,
  COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = true) AS active_tenants,
  COALESCE(SUM(t.leased_sf) FILTER (WHERE t.is_active = true), 0) AS total_leased_sf,
  CASE WHEN mp.building_size > 0
    THEN ROUND((COALESCE(SUM(t.leased_sf) FILTER (WHERE t.is_active = true), 0) / mp.building_size * 100)::NUMERIC, 1)
    ELSE 0
  END AS occupancy_percent,
  COALESCE(SUM(t.monthly_base_rent) FILTER (WHERE t.is_active = true), 0) AS monthly_rent_income,
  COALESCE(SUM(oe.amount), 0) AS total_expenses_ytd
FROM master_properties mp
LEFT JOIN tenants t ON t.master_property_id = mp.id
LEFT JOIN operating_expenses oe ON oe.master_property_id = mp.id
  AND oe.expense_date >= date_trunc('year', CURRENT_DATE)
WHERE mp.is_managed = true AND mp.is_deleted = false
GROUP BY mp.id, mp.address, mp.city, mp.state, mp.property_type, mp.building_size,
         mp.management_tier, mp.management_fee_percent, mp.management_start_date;

-- ============================================================================
-- STEP 7: Create Indexes
-- ============================================================================

-- Vendors
CREATE INDEX idx_vendors_created_by ON vendors(created_by);
CREATE INDEX idx_vendors_trade ON vendors(trade);

-- Tenants
CREATE INDEX idx_tenants_master_property_id ON tenants(master_property_id);
CREATE INDEX idx_tenants_contact_id ON tenants(contact_id);

-- Rent Payments
CREATE INDEX idx_rent_payments_tenant_id ON rent_payments(tenant_id);
CREATE INDEX idx_rent_payments_tenant_period ON rent_payments(tenant_id, period_start);

-- Operating Expenses
CREATE INDEX idx_operating_expenses_property_id ON operating_expenses(master_property_id);
CREATE INDEX idx_operating_expenses_property_date ON operating_expenses(master_property_id, expense_date);
CREATE INDEX idx_operating_expenses_vendor_id ON operating_expenses(vendor_id);
CREATE INDEX idx_operating_expenses_category ON operating_expenses(category);

-- CAM Reconciliations
CREATE INDEX idx_cam_reconciliations_property_id ON cam_reconciliations(master_property_id);
CREATE INDEX idx_cam_reconciliation_items_reconciliation_id ON cam_reconciliation_items(reconciliation_id);
CREATE INDEX idx_cam_reconciliation_items_tenant_id ON cam_reconciliation_items(tenant_id);

-- Budgets
CREATE INDEX idx_property_budgets_property_id ON property_budgets(master_property_id);
CREATE INDEX idx_budget_line_items_budget_id ON budget_line_items(budget_id);

-- Inspections
CREATE INDEX idx_inspections_property_id ON inspections(master_property_id);
CREATE INDEX idx_condition_items_inspection_id ON condition_items(inspection_id);

-- Work Orders
CREATE INDEX idx_work_orders_property_id ON work_orders(master_property_id);
CREATE INDEX idx_work_orders_vendor_id ON work_orders(vendor_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);

-- Capital Projects
CREATE INDEX idx_capital_projects_property_id ON capital_projects(master_property_id);
CREATE INDEX idx_capital_projects_vendor_id ON capital_projects(vendor_id);

-- Compliance Items
CREATE INDEX idx_compliance_items_property_id ON compliance_items(master_property_id);
CREATE INDEX idx_compliance_items_due_date ON compliance_items(master_property_id, due_date);
CREATE INDEX idx_compliance_items_vendor_id ON compliance_items(vendor_id);

-- Master Properties managed flag
CREATE INDEX idx_master_properties_is_managed ON master_properties(is_managed) WHERE is_managed = true;

-- ============================================================================
-- STEP 8: Enable RLS on all new tables
-- ============================================================================

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cam_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cam_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: RLS Policies — service_role full access (backend uses supabaseAdmin)
-- ============================================================================

CREATE POLICY "Service role full access to vendors" ON vendors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to tenants" ON tenants FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to rent_payments" ON rent_payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to operating_expenses" ON operating_expenses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to cam_reconciliations" ON cam_reconciliations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to cam_reconciliation_items" ON cam_reconciliation_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to property_budgets" ON property_budgets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to budget_line_items" ON budget_line_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to inspections" ON inspections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to condition_items" ON condition_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to work_orders" ON work_orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to capital_projects" ON capital_projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to compliance_items" ON compliance_items FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 10: Updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rent_payments_updated_at BEFORE UPDATE ON rent_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operating_expenses_updated_at BEFORE UPDATE ON operating_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cam_reconciliations_updated_at BEFORE UPDATE ON cam_reconciliations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_property_budgets_updated_at BEFORE UPDATE ON property_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_condition_items_updated_at BEFORE UPDATE ON condition_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_capital_projects_updated_at BEFORE UPDATE ON capital_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_items_updated_at BEFORE UPDATE ON compliance_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Done! Run this in Supabase SQL Editor.
-- ============================================================================
