-- ============================================================
-- FIX: claim/create failed with
--   column "property_type" of relation "fs_listings" does not exist
-- Cause: findastay_listing_meta.sql was never run on the live DB, so the
-- columns fs_claim_listing / fs_create_listing write to don't exist.
-- Safe + idempotent — run once in the Supabase SQL editor.
-- ============================================================

alter table fs_listings add column if not exists property_type     text;
alter table fs_listings add column if not exists payment_terms      text default 'on_arrival';
alter table fs_listings add column if not exists payment_lead_days  int;

notify pgrst, 'reload schema';
