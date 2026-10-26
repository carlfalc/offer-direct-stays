-- findastay — business "go live" / publish state
-- A property is LIVE only when the owner has reviewed content + prices and hit "Go live".
-- Run this whole file in the Supabase SQL editor.

-- 1. Publish columns on fs_listings -----------------------------------------
alter table fs_listings add column if not exists published_at        timestamptz;
alter table fs_listings add column if not exists content_reviewed_at timestamptz;

create index if not exists idx_fs_listings_published on fs_listings(published_at);

-- 2. Backfill: anything already approved with EVERY room priced is treated as
--    live, so nothing that was already showing real prices regresses.
update fs_listings l
set published_at = coalesce(l.published_at, now()),
    content_reviewed_at = coalesce(l.content_reviewed_at, now())
where l.status = 'active'
  and l.published_at is null
  and exists (select 1 from fs_listing_rooms r where r.listing_id = l.id)
  and not exists (
    select 1 from fs_listing_rooms r
    where r.listing_id = l.id and r.base_guide is null
  );

-- 3. fs_set_live(listing) — owner-only publish, gated on readiness ----------
create or replace function fs_set_live(p_listing uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_status   fs_listing_status;
  v_rooms    int;
  v_unpriced int;
  v_now      timestamptz := now();
begin
  select owner_id, status into v_owner, v_status
    from fs_listings where id = p_listing;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not your listing';
  end if;
  if v_status <> 'active' then
    raise exception 'Property is not approved yet';
  end if;

  select count(*), count(*) filter (where base_guide is null)
    into v_rooms, v_unpriced
    from fs_listing_rooms where listing_id = p_listing;

  if v_rooms = 0 then
    raise exception 'No rooms to publish';
  end if;
  if v_unpriced > 0 then
    raise exception 'Every room needs a guide price first';
  end if;

  update fs_listings
    set published_at = v_now,
        content_reviewed_at = v_now,
        updated_at = v_now
    where id = p_listing;

  return v_now;
end;
$$;

-- 4. fs_set_offline(listing) — owner-only take-down -------------------------
create or replace function fs_set_offline(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from fs_listings where id = p_listing;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Not your listing';
  end if;
  update fs_listings set published_at = null, updated_at = now() where id = p_listing;
end;
$$;

grant execute on function fs_set_live(uuid)    to authenticated;
grant execute on function fs_set_offline(uuid) to authenticated;
