-- Expand property_type enum to support non-industrial property types
-- Currently only has: warehouse, distribution_center, manufacturing, flex_space, cold_storage, other
-- Adding: retail, office, land, residential, multifamily, mixed_use, industrial

ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'retail';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'office';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'land';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'residential';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'multifamily';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'mixed_use';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'industrial';
