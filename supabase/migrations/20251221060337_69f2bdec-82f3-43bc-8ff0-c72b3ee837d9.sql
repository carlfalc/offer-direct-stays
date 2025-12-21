-- Add 'submitted' and 'cancelled' to the offer_status enum
ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'cancelled';