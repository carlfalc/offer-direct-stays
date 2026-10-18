-- ============================================================
-- findastay — grant Data API roles access to the public schema.
-- Needed because "Automatically expose new tables" was off at project
-- creation, so tables had RLS policies but no base GRANTs.
-- Row-level security (already in place) still controls WHICH rows each
-- user sees; these GRANTs just let the API roles reach the tables.
-- This is exactly what Supabase does by default. Safe to re-run.
-- Paste into Supabase → SQL Editor → New query → Run.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables     in schema public to anon, authenticated, service_role;
grant all on all sequences  in schema public to anon, authenticated, service_role;
grant all on all routines   in schema public to anon, authenticated, service_role;

-- make future tables/sequences/functions inherit the same grants
alter default privileges in schema public grant all on tables     to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences  to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines   to anon, authenticated, service_role;

-- tell the API to refresh
notify pgrst, 'reload schema';
