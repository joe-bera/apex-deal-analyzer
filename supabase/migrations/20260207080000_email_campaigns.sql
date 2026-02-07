-- Phase 7: Email Campaigns
-- Tables: email_campaigns, email_recipients, email_unsubscribes

-- ============================================================================
-- email_campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (campaign_type IN ('new_listing', 'price_reduction', 'just_closed', 'market_update', 'custom')),
  subject TEXT,
  html_body TEXT,
  master_property_id UUID REFERENCES master_properties(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent')),
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- email_recipients
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- email_unsubscribes
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  reason TEXT,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_email_campaigns_created_by ON email_campaigns(created_by);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_recipients_campaign_id ON email_recipients(campaign_id);
CREATE INDEX idx_email_recipients_email ON email_recipients(email);
CREATE INDEX idx_email_unsubscribes_email ON email_unsubscribes(email);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- email_campaigns
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns"
  ON email_campaigns FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create own campaigns"
  ON email_campaigns FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own campaigns"
  ON email_campaigns FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own campaigns"
  ON email_campaigns FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Service role full access to campaigns"
  ON email_campaigns FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- email_recipients
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipients of own campaigns"
  ON email_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_campaigns
      WHERE email_campaigns.id = email_recipients.campaign_id
        AND email_campaigns.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert recipients to own campaigns"
  ON email_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_campaigns
      WHERE email_campaigns.id = email_recipients.campaign_id
        AND email_campaigns.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update recipients of own campaigns"
  ON email_recipients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM email_campaigns
      WHERE email_campaigns.id = email_recipients.campaign_id
        AND email_campaigns.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete recipients of own campaigns"
  ON email_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM email_campaigns
      WHERE email_campaigns.id = email_recipients.campaign_id
        AND email_campaigns.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role full access to recipients"
  ON email_recipients FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- email_unsubscribes
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert unsubscribes"
  ON email_unsubscribes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view unsubscribes"
  ON email_unsubscribes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access to unsubscribes"
  ON email_unsubscribes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
