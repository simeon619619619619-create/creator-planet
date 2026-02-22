-- ============================================================================
-- TBI BANK FUSION PAY INTEGRATION
-- Migration for TBI Bank installment payment system
-- ============================================================================

-- ============================================================================
-- 1. Add TBI columns to communities table
-- ============================================================================

ALTER TABLE communities ADD COLUMN IF NOT EXISTS tbi_enabled BOOLEAN DEFAULT false;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS tbi_min_amount_cents INTEGER DEFAULT 5000; -- 50 EUR minimum

-- ============================================================================
-- 2. Create tbi_installment_schemes table (cached from TBI API)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbi_installment_schemes (
  scheme_id INTEGER PRIMARY KEY,
  name VARCHAR(100),
  installment_count INTEGER NOT NULL,
  installment_factor DECIMAL(10,6), -- TBI's installment factor for calculating monthly payment
  total_due_factor DECIMAL(10,6),   -- TBI's total due factor for calculating total cost
  interest_rate DECIMAL(5,2),
  apr DECIMAL(5,2),
  min_amount_cents INTEGER DEFAULT 5000,    -- 50 EUR minimum
  max_amount_cents INTEGER DEFAULT 249999,  -- 2499.99 EUR maximum
  is_promo BOOLEAN DEFAULT false,
  reseller_code VARCHAR(50),
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- ============================================================================
-- 3. Create tbi_applications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbi_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  creator_id UUID REFERENCES profiles(id) NOT NULL,
  membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,

  -- TBI Application Data
  tbi_application_id VARCHAR(255), -- TBI's internal ID
  tbi_order_id VARCHAR(255) UNIQUE, -- Our order reference

  -- Financial
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  scheme_id INTEGER REFERENCES tbi_installment_schemes(scheme_id),
  downpayment_cents INTEGER DEFAULT 0,
  monthly_installment_cents INTEGER,
  installment_count INTEGER,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'cancelled', 'completed', 'expired')),
  tbi_status VARCHAR(50), -- TBI's internal status code

  -- Customer data (sensitive fields)
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_first_name VARCHAR(100),
  customer_last_name VARCHAR(100),
  customer_egn VARCHAR(255), -- Hashed EGN (never store plain text)

  -- URLs and tracking
  status_url VARCHAR(500), -- Webhook callback URL

  -- Callback tracking
  callback_received_at TIMESTAMPTZ,
  callback_payload JSONB,

  -- Access control
  access_granted BOOLEAN DEFAULT false,
  access_granted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Application expires after X days

  -- Ensure at least one product reference
  CONSTRAINT tbi_application_has_product CHECK (community_id IS NOT NULL OR course_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tbi_applications_buyer ON tbi_applications(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tbi_applications_creator ON tbi_applications(creator_id);
CREATE INDEX IF NOT EXISTS idx_tbi_applications_status ON tbi_applications(status);
CREATE INDEX IF NOT EXISTS idx_tbi_applications_tbi_id ON tbi_applications(tbi_application_id);
CREATE INDEX IF NOT EXISTS idx_tbi_applications_order_id ON tbi_applications(tbi_order_id);
CREATE INDEX IF NOT EXISTS idx_tbi_applications_community ON tbi_applications(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tbi_applications_course ON tbi_applications(course_id) WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tbi_applications_pending ON tbi_applications(status, expires_at) WHERE status IN ('pending', 'processing');

-- ============================================================================
-- 4. Create tbi_webhook_events table (for idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbi_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tbi_event_id VARCHAR(255) UNIQUE NOT NULL, -- TBI's event ID for deduplication
  application_id UUID REFERENCES tbi_applications(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  processing_result VARCHAR(50), -- success, error, skipped
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tbi_webhook_events_application ON tbi_webhook_events(application_id);
CREATE INDEX IF NOT EXISTS idx_tbi_webhook_events_type ON tbi_webhook_events(event_type);

-- ============================================================================
-- 5. Create trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tbi_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tbi_applications_updated_at ON tbi_applications;
CREATE TRIGGER tbi_applications_updated_at
  BEFORE UPDATE ON tbi_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_tbi_application_updated_at();

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE tbi_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbi_installment_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbi_webhook_events ENABLE ROW LEVEL SECURITY;

-- tbi_installment_schemes: Authenticated users can read (public cache)
CREATE POLICY "Authenticated users can read TBI schemes"
ON tbi_installment_schemes
FOR SELECT
TO authenticated
USING (true);

-- tbi_applications: Users can view their own applications
CREATE POLICY "Users can view their own TBI applications"
ON tbi_applications
FOR SELECT
TO authenticated
USING (buyer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- tbi_applications: Creators can view applications for their products
CREATE POLICY "Creators can view TBI applications for their products"
ON tbi_applications
FOR SELECT
TO authenticated
USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- tbi_applications: Users can create applications
CREATE POLICY "Users can create TBI applications"
ON tbi_applications
FOR INSERT
TO authenticated
WITH CHECK (buyer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- tbi_webhook_events: Service role only (webhooks use service_role)
-- No policies needed for regular users - service_role bypasses RLS

-- ============================================================================
-- 7. Helper function to get profile ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tbi_profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 8. Comments for documentation
-- ============================================================================

COMMENT ON TABLE tbi_applications IS 'TBI Bank installment payment applications';
COMMENT ON TABLE tbi_installment_schemes IS 'Cached TBI installment schemes from API';
COMMENT ON TABLE tbi_webhook_events IS 'TBI webhook events for idempotent processing';

COMMENT ON COLUMN tbi_applications.customer_egn IS 'SHA-256 hash of Bulgarian personal ID - never store plain text';
COMMENT ON COLUMN tbi_applications.status IS 'Application status: pending, processing, approved, rejected, cancelled, completed, expired';
COMMENT ON COLUMN tbi_applications.tbi_order_id IS 'Our internal order ID sent to TBI for reference';
COMMENT ON COLUMN tbi_installment_schemes.installment_factor IS 'TBI factor to multiply by amount to get monthly installment';
COMMENT ON COLUMN tbi_installment_schemes.total_due_factor IS 'TBI factor to multiply by amount to get total due with interest';
