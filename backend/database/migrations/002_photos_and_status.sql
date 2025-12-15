-- =====================================================
-- Migration: Add Property Photos and Status Tracking
-- =====================================================
-- Run this in Supabase SQL Editor to add:
-- 1. Property status enum and column
-- 2. Property photos table
-- =====================================================

-- -----------------------------------------------------
-- 1. Property Status Enum
-- -----------------------------------------------------
-- Pipeline stages for tracking properties
CREATE TYPE property_status AS ENUM (
  'prospect',        -- Property identified, not yet contacted
  'contacted',       -- Owner/broker contacted
  'pitched',         -- Presented listing proposal
  'listed',          -- Active listing
  'under_contract',  -- Deal in progress
  'sold',            -- Transaction completed
  'dead',            -- Deal fell through / not pursuing
  'watch'            -- Watching for future opportunity
);

-- Add status column to properties table
ALTER TABLE properties
ADD COLUMN status property_status DEFAULT 'prospect';

-- Add index for filtering by status
CREATE INDEX idx_properties_status ON properties(status);

-- -----------------------------------------------------
-- 2. Property Photos Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Photo Information
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- Supabase Storage path
  file_size INTEGER NOT NULL CHECK (file_size > 0),

  -- Photo metadata
  photo_type TEXT DEFAULT 'exterior',  -- exterior, interior, aerial, loading_dock, parking, other
  caption TEXT,
  sort_order INTEGER DEFAULT 0,  -- For ordering photos in gallery
  is_primary BOOLEAN DEFAULT false,  -- Primary photo shown on property card

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_property_photos_property_id ON property_photos(property_id);
CREATE INDEX idx_property_photos_uploaded_by ON property_photos(uploaded_by);
CREATE INDEX idx_property_photos_is_primary ON property_photos(is_primary);

-- Comment
COMMENT ON TABLE property_photos IS 'Photos associated with properties for visual documentation';

-- -----------------------------------------------------
-- 3. Row Level Security for Photos
-- -----------------------------------------------------
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

-- Users can view photos for properties they own
CREATE POLICY "Users can view photos for their properties"
  ON property_photos FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
        AND properties.created_by = auth.uid()
    )
  );

-- Users can upload photos to their own properties
CREATE POLICY "Users can upload photos to their properties"
  ON property_photos FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
        AND properties.created_by = auth.uid()
    )
  );

-- Users can update their own photos
CREATE POLICY "Users can update own photos"
  ON property_photos FOR UPDATE
  USING (uploaded_by = auth.uid());

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON property_photos FOR DELETE
  USING (uploaded_by = auth.uid());

-- -----------------------------------------------------
-- 4. Trigger for updated_at (photos don't have this, but good practice)
-- -----------------------------------------------------
-- None needed for photos since we only track uploaded_at

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
