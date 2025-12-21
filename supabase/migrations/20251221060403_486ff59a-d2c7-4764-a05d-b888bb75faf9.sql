-- Change the default status for new offers to 'submitted'
ALTER TABLE offers ALTER COLUMN status SET DEFAULT 'submitted'::offer_status;

-- Add response_token_expires_at column with 14-day default
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS response_token_expires_at timestamptz 
DEFAULT (now() + interval '14 days');

-- Add unique constraint on response_token
ALTER TABLE offers 
ADD CONSTRAINT offers_response_token_unique UNIQUE (response_token);