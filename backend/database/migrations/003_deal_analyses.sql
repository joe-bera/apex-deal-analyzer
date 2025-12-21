-- =====================================================
-- Migration: Add Deal Analysis Worksheet Tables
-- =====================================================
-- CCIM-level deal analysis with income/expense proforma,
-- debt analysis, and cash flow calculations.
-- =====================================================

-- -----------------------------------------------------
-- 1. Deal Analyses Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Income Analysis
  potential_gross_income DECIMAL(15,2),
  vacancy_rate DECIMAL(5,2) DEFAULT 5.00,
  vacancy_amount DECIMAL(15,2),
  other_income DECIMAL(15,2) DEFAULT 0,
  effective_gross_income DECIMAL(15,2),

  -- Expense Analysis (itemized)
  property_taxes DECIMAL(15,2),
  insurance DECIMAL(15,2),
  utilities DECIMAL(15,2),
  management_fee_percent DECIMAL(5,2) DEFAULT 3.00,
  management_fee_amount DECIMAL(15,2),
  repairs_maintenance DECIMAL(15,2),
  reserves_capex DECIMAL(15,2),
  other_expenses DECIMAL(15,2),
  total_operating_expenses DECIMAL(15,2),
  operating_expense_ratio DECIMAL(5,2),

  -- Calculated Values
  net_operating_income DECIMAL(15,2),
  cap_rate DECIMAL(5,2),
  price_per_sqft DECIMAL(10,2),
  grm DECIMAL(10,2),

  -- Financing
  purchase_price DECIMAL(15,2),
  loan_amount DECIMAL(15,2),
  ltv_percent DECIMAL(5,2) DEFAULT 70.00,
  interest_rate DECIMAL(5,3) DEFAULT 7.000,
  amortization_years INTEGER DEFAULT 25,
  loan_term_years INTEGER DEFAULT 10,
  monthly_payment DECIMAL(15,2),
  annual_debt_service DECIMAL(15,2),
  dscr DECIMAL(5,2),

  -- Cash Flow
  down_payment DECIMAL(15,2),
  closing_costs_percent DECIMAL(5,2) DEFAULT 2.00,
  closing_costs DECIMAL(15,2),
  total_cash_required DECIMAL(15,2),
  before_tax_cash_flow DECIMAL(15,2),
  cash_on_cash_return DECIMAL(5,2),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one analysis per property per user (can be relaxed later for scenarios)
  UNIQUE(property_id, created_by)
);

-- Add indexes
CREATE INDEX idx_deal_analyses_property ON deal_analyses(property_id);
CREATE INDEX idx_deal_analyses_created_by ON deal_analyses(created_by);

-- Comment
COMMENT ON TABLE deal_analyses IS 'CCIM-level deal analysis worksheets for properties';

-- -----------------------------------------------------
-- 2. Row Level Security
-- -----------------------------------------------------
ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;

-- Users can view their own analyses
CREATE POLICY "Users can view own deal analyses"
  ON deal_analyses FOR SELECT
  USING (created_by = auth.uid());

-- Users can create analyses for properties they own
CREATE POLICY "Users can create deal analyses"
  ON deal_analyses FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = deal_analyses.property_id
        AND properties.created_by = auth.uid()
    )
  );

-- Users can update their own analyses
CREATE POLICY "Users can update own deal analyses"
  ON deal_analyses FOR UPDATE
  USING (created_by = auth.uid());

-- Users can delete their own analyses
CREATE POLICY "Users can delete own deal analyses"
  ON deal_analyses FOR DELETE
  USING (created_by = auth.uid());

-- -----------------------------------------------------
-- 3. Updated At Trigger
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_deal_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_analyses_updated_at
  BEFORE UPDATE ON deal_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_analyses_updated_at();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
