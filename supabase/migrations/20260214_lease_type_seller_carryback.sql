-- Add lease type, seller carryback, and smart expense default columns to deal_analyses
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS lease_type TEXT DEFAULT 'gross';
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS nnn_reimbursement_rate DECIMAL(5,2) DEFAULT 100;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS modified_gross_reimbursement DECIMAL(15,2) DEFAULT 0;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS seller_carryback_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS seller_carryback_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS seller_carryback_term INTEGER DEFAULT 5;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS seller_carryback_monthly_payment DECIMAL(15,2) DEFAULT 0;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS seller_annual_debt_service DECIMAL(15,2) DEFAULT 0;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS auto_property_taxes BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS auto_insurance BOOLEAN DEFAULT false;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS auto_utilities BOOLEAN DEFAULT false;
