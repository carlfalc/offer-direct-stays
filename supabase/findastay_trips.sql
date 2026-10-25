-- ============================================================
-- Saved trips (traveller "wishlists"). A traveller saves a property
-- from the search results into a named trip (e.g. "Noosa"). The heart
-- on a result card turns red when that property is in any of their trips.
-- Run once in the Supabase SQL editor.
-- ============================================================

create table if not exists fs_trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists fs_trips_user_idx on fs_trips(user_id);

create table if not exists fs_trip_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references fs_trips(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  property_id text not null,                 -- LiteAPI hotel id or fs listing id
  name        text,
  city        text,
  country     text,
  image_url   text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now(),
  unique (trip_id, property_id)
);
create index if not exists fs_trip_items_trip_idx on fs_trip_items(trip_id);
create index if not exists fs_trip_items_user_idx on fs_trip_items(user_id);

-- Owner-only access.
alter table fs_trips      enable row level security;
alter table fs_trip_items enable row level security;

drop policy if exists fs_trips_own on fs_trips;
create policy fs_trips_own on fs_trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists fs_trip_items_own on fs_trip_items;
create policy fs_trip_items_own on fs_trip_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on fs_trips      to authenticated;
grant all on fs_trip_items to authenticated;
grant all on fs_trips      to service_role;
grant all on fs_trip_items to service_role;

notify pgrst, 'reload schema';
