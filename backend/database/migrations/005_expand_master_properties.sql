-- ============================================================================
-- Migration 005: Add missing columns to master_properties and transactions
-- ============================================================================
-- The backend controller (masterPropertyController.ts) supports ~60 fields
-- via bulk import, but migration 004 only created ~40 columns. This adds
-- the missing ~30 columns so inserts no longer fail.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add missing columns to master_properties
-- ============================================================================

-- Identification
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS apn TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS unit_suite TEXT;

-- Location
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS market TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS cross_street TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS opportunity_zone BOOLEAN DEFAULT false;

-- Size
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS typical_floor_size INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS number_of_buildings INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS number_of_addresses INTEGER;

-- Building details
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS month_built INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS month_renovated INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS construction_material TEXT;

-- Industrial
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS column_spacing TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS number_of_cranes INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS power TEXT;

-- Office
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS office_space INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS number_of_elevators INTEGER;

-- Leasing / Status
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS vacancy_percent DECIMAL(5,2);
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS days_on_market INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS rent_per_sf DECIMAL(10,2);
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS avg_weighted_rent DECIMAL(10,2);

-- Owner extended
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS mailing_city TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS mailing_state TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS mailing_zip TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS mailing_care_of TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS parent_company TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS fund_name TEXT;

-- Tax / Value
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS improvement_value DECIMAL(15,2);
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS land_value DECIMAL(15,2);
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS total_parcel_value DECIMAL(15,2);
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS parcel_value_type TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS tax_year INTEGER;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS annual_tax_bill DECIMAL(15,2);

-- Utilities / Amenities
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS water TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS sewer TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS gas TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS amenities TEXT;
ALTER TABLE master_properties ADD COLUMN IF NOT EXISTS features TEXT;

-- ============================================================================
-- STEP 2: Add missing columns to transactions
-- ============================================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asking_cap_rate DECIMAL(5,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS price_per_acre DECIMAL(15,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS for_sale_status TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lease_term TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lease_expiration_date DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lender TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loan_amount DECIMAL(15,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loan_type TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,3);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS maturity_date DATE;
-- lease_rate may also be missing; adding just in case
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lease_rate DECIMAL(10,2);

-- ============================================================================
-- STEP 3: Recreate the view to include new columns
-- ============================================================================
-- DROP and re-CREATE because CREATE OR REPLACE VIEW cannot add columns
-- to an existing view that selects mp.* (the underlying table changed).

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
-- Done! Run this in Supabase SQL Editor.
-- ============================================================================
