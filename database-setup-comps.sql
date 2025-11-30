-- Create comps table
CREATE TABLE IF NOT EXISTS public.comps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Comp property details
  comp_address TEXT NOT NULL,
  comp_city TEXT NOT NULL,
  comp_state TEXT NOT NULL,
  comp_zip_code TEXT,
  comp_property_type TEXT NOT NULL,
  comp_square_footage NUMERIC,
  comp_year_built INTEGER,

  -- Sale information
  comp_sale_price NUMERIC NOT NULL,
  comp_sale_date DATE NOT NULL,
  comp_price_per_sqft NUMERIC,
  comp_cap_rate NUMERIC,

  -- Analysis data
  distance_miles NUMERIC,
  similarity_score INTEGER, -- 0-100
  adjustment_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create deals table
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  deal_name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, analyzing, completed, archived

  -- Valuation results (JSON from AI analysis)
  valuation_result JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comps
CREATE POLICY "Users can view their own comps"
  ON public.comps FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own comps"
  ON public.comps FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own comps"
  ON public.comps FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own comps"
  ON public.comps FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for deals
CREATE POLICY "Users can view their own deals"
  ON public.deals FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own deals"
  ON public.deals FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own deals"
  ON public.deals FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own deals"
  ON public.deals FOR DELETE
  USING (auth.uid() = created_by);

-- Create update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comps_updated_at
  BEFORE UPDATE ON public.comps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comps_property_id ON public.comps(property_id);
CREATE INDEX IF NOT EXISTS idx_comps_created_by ON public.comps(created_by);
CREATE INDEX IF NOT EXISTS idx_deals_property_id ON public.deals(property_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON public.deals(created_by);
