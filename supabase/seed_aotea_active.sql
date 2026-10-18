-- Seed Aotea Motor Lodge as an ACTIVE findastay listing, owned by Carl.
-- Lets you see the claimed experience (Open to offers + Make an Offer) next to the
-- unclaimed LiteAPI properties on the Whanganui map. Safe to re-run.

insert into fs_listings
  (liteapi_hotel_id, owner_id, status, name, city, country, latitude, longitude, thumbnail,
   auto_accept_enabled, content_synced_at, claimed_at, approved_at)
values
  ('lp543c0',
   (select id from auth.users where email = 'falconercarlandrew@gmail.com'),
   'active', 'Aotea Motor Lodge', 'Whanganui', 'NZ', -39.925811, 175.040185,
   'https://static.cupid.travel/hotels/4002082.jpg',
   true, now(), now(), now())
on conflict (liteapi_hotel_id) do update
  set status = 'active',
      owner_id = excluded.owner_id,
      approved_at = now(),
      updated_at = now();

notify pgrst, 'reload schema';
