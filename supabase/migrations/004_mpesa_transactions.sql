-- M-Pesa Transactions Table
-- Stores STK Push transaction status from M-Pesa callbacks

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id VARCHAR(100) UNIQUE NOT NULL,
  merchant_request_id VARCHAR(100),
  phone_number VARCHAR(15),
  amount DECIMAL(10,2),
  account_reference VARCHAR(100),
  transaction_desc VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  result_code INTEGER,
  result_desc TEXT,
  mpesa_receipt_number VARCHAR(50),
  transaction_date TIMESTAMP,
  raw_callback JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups by checkout_request_id
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request ON mpesa_transactions(checkout_request_id);

-- Index for lookups by phone number (for verification)
CREATE INDEX IF NOT EXISTS idx_mpesa_phone ON mpesa_transactions(phone_number);

-- Index for recent transactions
CREATE INDEX IF NOT EXISTS idx_mpesa_created ON mpesa_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for callbacks and backend)
CREATE POLICY "Service role full access" ON mpesa_transactions
  FOR ALL USING (true) WITH CHECK (true);
