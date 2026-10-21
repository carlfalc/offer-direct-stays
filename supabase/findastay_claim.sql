-- ============================================================
-- findastay: let a signed-in business claim a LiteAPI property.
-- Safely sets fs_listings.owner_id to the caller, unless already
-- claimed by someone else. Run once in the Supabase SQL editor.
-- ============================================================

create or replace function fs_claim_listing(
  p_hotel_id text,
  p_name     text,
  p_city     text,
  p_country  text,
  p_lat      double precision,
  p_lng      double precision,
  p_thumb    text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'You must be signed in to claim a property'; end if;

  select owner_id into v_owner from fs_listings where liteapi_hotel_id = p_hotel_id;
  if v_owner is not null and v_owner is distinct from v_uid then
    raise exception 'This property has already been claimed by another account';
  end if;

  insert into fs_listings(
    liteapi_hotel_id, owner_id, status, name, city, country,
    latitude, longitude, thumbnail, claimed_at, approved_at, content_synced_at)
  values (
    p_hotel_id, v_uid, 'active', p_name, p_city, p_country,
    p_lat, p_lng, p_thumb, now(), now(), now())
  on conflict (liteapi_hotel_id) do update set
    owner_id    = v_uid,
    status      = 'active',
    name        = coalesce(excluded.name, fs_listings.name),
    city        = coalesce(excluded.city, fs_listings.city),
    country     = coalesce(excluded.country, fs_listings.country),
    latitude    = coalesce(excluded.latitude, fs_listings.latitude),
    longitude   = coalesce(excluded.longitude, fs_listings.longitude),
    thumbnail   = coalesce(excluded.thumbnail, fs_listings.thumbnail),
    claimed_at  = coalesce(fs_listings.claimed_at, now()),
    approved_at = now(),
    updated_at  = now()
  returning id into v_id;

  return jsonb_build_object('listing_id', v_id, 'status', 'active');
end $$;

revoke all on function fs_claim_listing(text,text,text,double precision,double precision,text) from public, anon;
grant execute on function fs_claim_listing(text,text,text,double precision,double precision,text) to authenticated;

notify pgrst, 'reload schema';
