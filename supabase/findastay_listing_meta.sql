-- ============================================================
-- Listing metadata: property type (for the search category filter) and
-- payment terms (when the balance is due). Owners set these on listing
-- setup. RLS already lets an owner update their own fs_listings row.
-- Run once in the Supabase SQL editor.
-- ============================================================

alter table fs_listings add column if not exists property_type     text;              -- hotel|motel|lodge|resort|bnb|home_apartment|holiday_park
alter table fs_listings add column if not exists payment_terms      text default 'on_arrival';  -- on_arrival|days_before|upfront
alter table fs_listings add column if not exists payment_lead_days  int;               -- used when payment_terms = 'days_before'

notify pgrst, 'reload schema';
