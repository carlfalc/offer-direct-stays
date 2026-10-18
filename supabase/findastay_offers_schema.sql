-- =====================================================================
-- findastay — listings, pricing & offer-engine schema
-- Run in Supabase SQL editor (project tqsqlwmdhqpvidptyrzp).
-- Safe to re-run: guards everything with IF NOT EXISTS / DO blocks.
--
-- All tables are prefixed fs_ (findastay) so they never collide with the
-- original Lovable tables (e.g. an existing empty "offers"). The new app
-- points only at the fs_ tables; old tables are left untouched.
--
-- PRIVACY DESIGN (important):
--   Travellers / anon may read:  fs_listings, fs_listing_rooms (guide only).
--   NEVER exposed to travellers:  auto-accept price, floor price, periods.
--   Those live in private tables readable only by the owning business and
--   the service_role (which the offer engine uses).
-- =====================================================================

-- ---------- enums (guarded, fs_ prefixed) ----------
do $$ begin
  create type fs_listing_status as enum ('unclaimed','pending','active','declined','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fs_offer_status as enum (
    'pending',                  -- sent, awaiting business
    'accepted_pending_confirm', -- business accepted; traveller must confirm within 1h
    'countered',                -- business countered; traveller must respond within 1h
    'confirmed',                -- traveller confirmed -> contract / booking locked
    'declined',                 -- business declined
    'expired',                  -- traveller didn't confirm in time, or 24h cap hit
    'withdrawn'                 -- traveller pulled the offer
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fs_responder_kind as enum ('auto','business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fs_lead_type as enum ('traveller_nudge','owner_claim');
exception when duplicate_object then null; end $$;

-- ---------- 1. fs_listings (public read) ----------
create table if not exists fs_listings (
  id                  uuid primary key default gen_random_uuid(),
  liteapi_hotel_id    text not null unique,              -- e.g. 'lp543c0'
  owner_id            uuid references auth.users(id),    -- null until claimed+approved
  status              fs_listing_status not null default 'unclaimed',
  auto_accept_enabled boolean not null default true,     -- master toggle (business)
  -- cached LiteAPI content for fast map rendering
  name                text,
  city                text,
  country             text,
  latitude            double precision,
  longitude           double precision,
  thumbnail           text,
  content_synced_at   timestamptz,
  claimed_at          timestamptz,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_fs_listings_status on fs_listings(status);
create index if not exists idx_fs_listings_geo on fs_listings(latitude, longitude);

-- ---------- 2. fs_listing_rooms (public read: guide only) ----------
create table if not exists fs_listing_rooms (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references fs_listings(id) on delete cascade,
  liteapi_room_id  text not null,                        -- e.g. '3379853'
  room_name        text,
  max_occupancy    int,
  max_adults       int,
  max_children     int,
  base_guide       numeric(10,2),                        -- PUBLIC "from" price
  currency         text not null default 'NZD',
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (listing_id, liteapi_room_id)
);
create index if not exists idx_fs_listing_rooms_listing on fs_listing_rooms(listing_id);

-- ---------- 3. fs_room_thresholds (PRIVATE: auto + floor) ----------
create table if not exists fs_room_thresholds (
  listing_room_id  uuid primary key references fs_listing_rooms(id) on delete cascade,
  base_auto        numeric(10,2),   -- auto-accept at/above (never shown to travellers)
  base_floor       numeric(10,2),   -- lowest acceptable (never shown to travellers)
  updated_at       timestamptz not null default now()
);

-- ---------- 4. fs_pricing_periods (PRIVATE: seasonal windows) ----------
create table if not exists fs_pricing_periods (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references fs_listings(id) on delete cascade,
  label            text not null,                        -- 'Christmas / New Year'
  start_date       date not null,
  end_date         date not null,
  adjust_sign      smallint not null default 1,          -- +1 up, -1 down
  adjust_pct       numeric(5,2) not null default 20,     -- bulk % default 20
  recurs_annually  boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_fs_periods_listing on fs_pricing_periods(listing_id);

-- ---------- 4b. fs_period_room_rates (PRIVATE: per-room override in a period) ----------
-- manually_set = true  -> business hand-typed this cell; keep it when base/% changes.
-- manually_set = false -> derived from the period's %; recompute when base/% changes.
create table if not exists fs_period_room_rates (
  id               uuid primary key default gen_random_uuid(),
  period_id        uuid not null references fs_pricing_periods(id) on delete cascade,
  listing_room_id  uuid not null references fs_listing_rooms(id) on delete cascade,
  guide            numeric(10,2),
  auto             numeric(10,2),
  floor            numeric(10,2),
  manually_set     boolean not null default false,
  unique (period_id, listing_room_id)
);

-- ---------- 5. fs_offers (lifecycle + timing) ----------
create table if not exists fs_offers (
  id                      uuid primary key default gen_random_uuid(),
  listing_id              uuid not null references fs_listings(id),
  listing_room_id         uuid not null references fs_listing_rooms(id),
  traveller_id            uuid not null references auth.users(id),
  -- what the traveller asked for
  check_in                date not null,
  check_out               date not null,
  nights                  int not null,
  adults                  int not null default 1,
  children                int not null default 0,
  nightly_offer           numeric(10,2) not null,
  total_offer             numeric(10,2) not null,        -- nightly * nights
  message                 text,
  status                  fs_offer_status not null default 'pending',
  -- business response
  responded_by            fs_responder_kind,
  counter_nightly         numeric(10,2),                 -- set if countered
  -- timing (the engine fills/acts on these)
  created_at              timestamptz not null default now(),
  overall_expires_at      timestamptz not null default (now() + interval '24 hours'),  -- hard cap
  business_responded_at   timestamptz,
  release_to_traveller_at timestamptz,                   -- auto-accept: responded + ~7 min
  confirm_deadline_at     timestamptz,                   -- accepted/countered: + 1 hour
  confirmed_at            timestamptz,
  expired_at              timestamptz,
  updated_at              timestamptz not null default now()
);
create index if not exists idx_fs_offers_status on fs_offers(status);
create index if not exists idx_fs_offers_listing on fs_offers(listing_id);
create index if not exists idx_fs_offers_traveller on fs_offers(traveller_id);
-- the engine scans these to fire releases / expiries on time:
create index if not exists idx_fs_offers_release on fs_offers(release_to_traveller_at)
  where status = 'accepted_pending_confirm';
create index if not exists idx_fs_offers_confirm_deadline on fs_offers(confirm_deadline_at)
  where status in ('accepted_pending_confirm','countered');

-- ---------- 6. fs_listing_leads (owner claims + traveller nudges) ----------
create table if not exists fs_listing_leads (
  id               uuid primary key default gen_random_uuid(),
  liteapi_hotel_id text not null,
  property_name    text,
  city             text,
  type             fs_lead_type not null,
  requested_by     uuid references auth.users(id),
  note             text,
  status           text not null default 'new',          -- new | contacted | onboarded | dismissed
  created_at       timestamptz not null default now()
);
create index if not exists idx_fs_leads_status on fs_listing_leads(status);

-- =====================================================================
-- Row Level Security  (service_role bypasses RLS, so the engine is unaffected)
-- =====================================================================
alter table fs_listings          enable row level security;
alter table fs_listing_rooms     enable row level security;
alter table fs_room_thresholds   enable row level security;
alter table fs_pricing_periods   enable row level security;
alter table fs_period_room_rates enable row level security;
alter table fs_offers            enable row level security;
alter table fs_listing_leads     enable row level security;

-- helper: does the current user own this listing?
create or replace function fs_owns_listing(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from fs_listings x where x.id = l and x.owner_id = auth.uid());
$$;

-- fs_listings: everyone can read (public map); owner can update their own.
drop policy if exists fs_listings_read on fs_listings;
create policy fs_listings_read on fs_listings for select using (true);
drop policy if exists fs_listings_owner_update on fs_listings;
create policy fs_listings_owner_update on fs_listings for update using (owner_id = auth.uid());

-- fs_listing_rooms: public read (guide only lives here); owner writes.
drop policy if exists fs_rooms_read on fs_listing_rooms;
create policy fs_rooms_read on fs_listing_rooms for select using (true);
drop policy if exists fs_rooms_owner_write on fs_listing_rooms;
create policy fs_rooms_owner_write on fs_listing_rooms for all
  using (fs_owns_listing(listing_id)) with check (fs_owns_listing(listing_id));

-- fs_room_thresholds: PRIVATE — only the owning business.
drop policy if exists fs_thresholds_owner on fs_room_thresholds;
create policy fs_thresholds_owner on fs_room_thresholds for all
  using (exists (select 1 from fs_listing_rooms r where r.id = listing_room_id and fs_owns_listing(r.listing_id)))
  with check (exists (select 1 from fs_listing_rooms r where r.id = listing_room_id and fs_owns_listing(r.listing_id)));

-- fs_pricing_periods + fs_period_room_rates: PRIVATE — owner only.
drop policy if exists fs_periods_owner on fs_pricing_periods;
create policy fs_periods_owner on fs_pricing_periods for all
  using (fs_owns_listing(listing_id)) with check (fs_owns_listing(listing_id));
drop policy if exists fs_period_rates_owner on fs_period_room_rates;
create policy fs_period_rates_owner on fs_period_room_rates for all
  using (exists (select 1 from fs_pricing_periods p where p.id = period_id and fs_owns_listing(p.listing_id)))
  with check (exists (select 1 from fs_pricing_periods p where p.id = period_id and fs_owns_listing(p.listing_id)));

-- fs_offers: traveller sees their own; business sees offers for their listings.
drop policy if exists fs_offers_read on fs_offers;
create policy fs_offers_read on fs_offers for select
  using (traveller_id = auth.uid() or fs_owns_listing(listing_id));
drop policy if exists fs_offers_traveller_insert on fs_offers;
create policy fs_offers_traveller_insert on fs_offers for insert
  with check (traveller_id = auth.uid());
drop policy if exists fs_offers_update on fs_offers;
create policy fs_offers_update on fs_offers for update
  using (traveller_id = auth.uid() or fs_owns_listing(listing_id));

-- fs_listing_leads: any user can create (claim/nudge); reads are admin (service_role) only.
drop policy if exists fs_leads_insert on fs_listing_leads;
create policy fs_leads_insert on fs_listing_leads for insert with check (true);

-- =====================================================================
-- Grants
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select on fs_listings, fs_listing_rooms to anon, authenticated;
grant select, insert, update on fs_offers to authenticated;
grant insert on fs_listing_leads to anon, authenticated;
grant all on fs_listings, fs_listing_rooms, fs_room_thresholds, fs_pricing_periods,
  fs_period_room_rates, fs_offers, fs_listing_leads to service_role;

notify pgrst, 'reload schema';
