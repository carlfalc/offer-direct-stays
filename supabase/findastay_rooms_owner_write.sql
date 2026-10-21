-- ============================================================
-- Owner-write grants for the business pricing editor.
-- RLS (fs_rooms_owner_write / fs_listings_owner_update + fs_owns_listing)
-- still restricts every write to listings the caller owns. Run once.
-- ============================================================

-- create/edit their own room rows (guide price lives here)
grant insert, update, delete on fs_listing_rooms to authenticated;

-- toggle auto-accept and edit their own listing
grant update on fs_listings to authenticated;

notify pgrst, 'reload schema';
