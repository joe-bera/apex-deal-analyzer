-- Investment Decision Engine: Add columns to deal_analyses
-- Strategy, Value-Add Attribution, As-Is vs Stabilized, Costs, Proforma Settings, Exit, Return Metrics

-- Strategy
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS investment_strategy TEXT DEFAULT 'value_add';

-- Value-Add Attribution
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_below_market_rents BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_below_market_rents_note TEXT;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_vacancy_leaseup BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_vacancy_leaseup_note TEXT;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_expense_reduction BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_expense_reduction_note TEXT;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_re_tenanting BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_re_tenanting_note TEXT;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_physical_improvements BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_physical_improvements_note TEXT;

-- As-Is vs Stabilized
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS as_is_rent_psf DECIMAL(10,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS stabilized_rent_psf DECIMAL(10,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS as_is_occupancy DECIMAL(5,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS stabilized_occupancy DECIMAL(5,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS as_is_other_income DECIMAL(15,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS stabilized_other_income DECIMAL(15,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS as_is_expense_ratio DECIMAL(5,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS stabilized_expense_ratio DECIMAL(5,2);

-- Value-Add Costs
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_capex DECIMAL(15,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_ti_leasing DECIMAL(15,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_carry_costs DECIMAL(15,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_contingency DECIMAL(15,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS va_total_cost DECIMAL(15,2);

-- Proforma Settings
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS income_growth_rate DECIMAL(5,2) DEFAULT 3.00;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS expense_growth_rate DECIMAL(5,2) DEFAULT 2.50;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS holding_period INTEGER DEFAULT 5;

-- Exit Analysis
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS exit_cap_rate DECIMAL(5,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS selling_costs_percent DECIMAL(5,2) DEFAULT 2.00;

-- Calculated Return Metrics (stored for quick access)
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS irr DECIMAL(8,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS equity_multiple DECIMAL(8,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS avg_cash_on_cash DECIMAL(5,2);
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS total_project_cost DECIMAL(15,2);
