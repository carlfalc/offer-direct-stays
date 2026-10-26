-- ============================================================
-- Test reset: free up Aotea Motor Lodge (lp543c0) so it can be re-claimed.
-- Removes the stale claim and everything hanging off it (rooms, prices,
-- offers, messages). Safe for testing; run once in Supabase SQL editor.
-- ============================================================

-- Offers first (their messages/reads cascade); then the listing (rooms/thresholds cascade).
delete from fs_offers
  where listing_id in (select id from fs_listings where liteapi_hotel_id = 'lp543c0');

delete from fs_listings where liteapi_hotel_id = 'lp543c0';
