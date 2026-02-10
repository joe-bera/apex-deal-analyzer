-- Add 'property_profile' to the document_type enum
-- This value is already used by the backend/frontend but was never added to the DB enum
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'property_profile';
