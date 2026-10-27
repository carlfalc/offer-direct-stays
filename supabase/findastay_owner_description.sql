-- ============================================================
-- Owner's description: a listing-level story the owner writes for travellers
-- (shown via "More details" on the listing). Run once in the Supabase SQL editor.
-- ============================================================

alter table fs_listings add column if not exists owner_description text;

notify pgrst, 'reload schema';
