-- =====================================================================
-- findastay — listings, pricing & offer-engine schema
-- Run in Supabase SQL editor (project tqsqlwmdhqpvidptyrzp).
-- Safe to re-run: guards everything with IF NOT EXISTS / DO blocks.
--
-- PRIVACY DESIGN (important):
--   Travellers / anon may read:  listings, listing_rooms (guide only).
--   NEVER exposed to travellers:  auto-accept price, floor price, periods.
--   Those live in private tables readable only by the owning business and
--   the service_role (which the offer engine uses). This is why pricing is
--   split across listing_rooms (public) and room_thresholds (private).
-- =====================================================================

-- ---------- enums (guarded) ----------
do $$ begin
  create type listing_status as enum ('unclaimed','pending','active','declined','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offer_status as enum (
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
  create type responder_kind as enum ('auto','business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_type as enum ('traveller_nudge','owner_claim');
exception when duplicate_object then null; end $$;

-- ---------- 1. LISTINGS (public read) ----------
create table if not exists listings (
  id                  uuid primary key default gen_random_uuid(),
  liteapi_hotel_id    text not null unique,              -- e.g. 'lp543c0'
  owner_id            uuid references auth.users(id),    -- null until claimed+approved
  status              listing_status not null default 'unclaimed',
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
create index if not exists idx_listings_status on listings(status);
create index if not exists idx_listings_geo on listings(latitude, longitude);

-- ---------- 2. LISTING_ROOMS (public read: guide only) ----------
create table if not exists listing_rooms (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references listings(id) on delete cascade,
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
create index if not exists idx_listing_rooms_listing on listing_rooms(listing_id);

-- ---------- 3. ROOM_THRESHOLDS (PRIVATE: auto + floor) ----------
create table if not exists room_thresholds (
  listing_room_id  uuid primary key references listing_rooms(id) on delete cascade,
  base_auto        numeric(10,2),   -- auto-accept at/above (never shown to travellers)
  base_floor       numeric(10,2),   -- lowest acceptable (never shown to travellers)
  updated_at       timestamptz not null default now()
);

-- ---------- 4. PRICING_PERIODS (PRIVATE: seasonal windows) ----------
create table if not exists pricing_periods (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references listings(id) on delete cascade,
  label            text not null,                        -- 'Christmas / New Year'
  start_date       date not null,
  end_date         date not null,
  adjust_sign      smallint not null default 1,          -- +1 up, -1 down
  adjust_pct       numeric(5,2) not null default 20,     -- bulk % default 20
  recurs_annually  boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_periods_listing on pricing_periods(listing_id);

-- ---------- 4b. PERIOD_ROOM_RATES (PRIVATE: per-room override in a period) ----------
-- manually_set = true  -> business hand-typed this cell; keep it when base/% changes.
-- manually_set = false -> derived from the period's %; recompute when base/% changes.
create table if not exists period_room_rates (
  id               uuid primary key default gen_random_uuid(),
  period_id        uuid not null references pricing_periods(id) on delete cascade,
  listing_room_id  uuid not null references listing_rooms(id) on delete cascade,
  guide            numeric(10,2),
  auto             numeric(10,2),
  floor            numeric(10,2),
  manually_set     boolean not null default false,
  unique (period_id, listing_room_id)
);

-- ---------- 5. OFFERS (lifecycle + timing) ----------
create table if not exists offers (
  id                      uuid primary key default gen_random_uuid(),
  listing_id              uuid not null references listings(id),
  listing_room_id         uuid not null references listing_rooms(id),
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
  status                  offer_status not null default 'pending',
  -- business response
  responded_by            responder_kind,
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
create index if not exists idx_offers_status on offers(status);
create index if not exists idx_offers_listing on offers(listing_id);
create index if not exists idx_offers_traveller on offers(traveller_id);
-- the engine scans these to fire releases / expiries on time:
create index if not exists idx_offers_release on offers(release_to_traveller_at)
  where status = 'accepted_pending_confirm';
create index if not exists idx_offers_confirm_deadline on offers(confirm_deadline_at)
  where status in ('accepted_pending_confirm','countered');

-- ---------- 6. LISTING_LEADS (owner claims + traveller nudges) ----------
create table if not exists listing_leads (
  id               uuid primary key default gen_random_uuid(),
  liteapi_hotel_id text not null,
  property_name    text,
  city             text,
  type             lead_type not null,
  requested_by     uuid references auth.users(id),
  note             text,
  status           text not null default 'new',          -- new | contacted | onboarded | dismissed
  created_at       timestamptz not null default now()
);
create index if not exists idx_leads_status on listing_leads(status);

-- =====================================================================
-- Row Level Security
-- service_role bypasses RLS automatically, so the offer engine (which runs
-- as service_role) is unaffected by the policies below.
-- =====================================================================
alter table listings          enable row level security;
alter table listing_rooms     enable row level security;
alter table room_thresholds   enable row level security;
alter table pricing_periods   enable row level security;
alter table period_room_rates enable row level security;
alter table offers            enable row level security;
alter table listing_leads     enable row level security;

-- helper: does the current user own this listing?
create or replace function fn_owns_listing(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings x where x.id = l and x.owner_id = auth.uid());
$$;

-- LISTINGS: everyone can read (public map); owner can update their own.
drop policy if exists listings_read on listings;
create policy listings_read on listings for select using (true);
drop policy if exists listings_owner_update on listings;
create policy listings_owner_update on listings for update using (owner_id = auth.uid());

-- LISTING_ROOMS: public read (guide only lives here); owner writes.
drop policy if exists rooms_read on listing_rooms;
create policy rooms_read on listing_rooms for select using (true);
drop policy if exists rooms_owner_write on listing_rooms;
create policy rooms_owner_write on listing_rooms for all
  using (fn_owns_listing(listing_id)) with check (fn_owns_listing(listing_id));

-- ROOM_THRESHOLDS: PRIVATE — only the owning business may read/write.
drop policy if exists thresholds_owner on room_thresholds;
create policy thresholds_owner on room_thresholds for all
  using (exists (select 1 from listing_rooms r where r.id = listing_room_id and fn_owns_listing(r.listing_id)))
  with check (exists (select 1 from listing_rooms r where r.id = listing_room_id and fn_owns_listing(r.listing_id)));

-- PRICING_PERIODS + PERIOD_ROOM_RATES: PRIVATE — owner only.
drop policy if exists periods_owner on pricing_periods;
create policy periods_owner on pricing_periods for all
  using (fn_owns_listing(listing_id)) with check (fn_owns_listing(listing_id));
drop policy if exists period_rates_owner on period_room_rates;
create policy period_rates_owner on period_room_rates for all
  using (exists (select 1 from pricing_periods p where p.id = period_id and fn_owns_listing(p.listing_id)))
  with check (exists (select 1 from pricing_periods p where p.id = period_id and fn_owns_listing(p.listing_id)));

-- OFFERS: traveller sees their own; business sees offers for their listings.
drop policy if exists offers_read on offers;
create policy offers_read on offers for select
  using (traveller_id = auth.uid() or fn_owns_listing(listing_id));
drop policy if exists offers_traveller_insert on offers;
create policy offers_traveller_insert on offers for insert
  with check (traveller_id = auth.uid());
-- traveller may confirm/withdraw their own; business may respond to theirs.
drop policy if exists offers_update on offers;
create policy offers_update on offers for update
  using (traveller_id = auth.uid() or fn_owns_listing(listing_id));

-- LISTING_LEADS: any signed-in user can create (claim or nudge); reads are admin
-- (service_role) only, so no SELECT policy for regular users.
drop policy if exists leads_insert on listing_leads;
create policy leads_insert on listing_leads for insert with check (true);

-- =====================================================================
-- Grants (mirror the project's existing pattern)
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select on listings, listing_rooms to anon, authenticated;
grant select, insert, update on offers to authenticated;
grant insert on listing_leads to anon, authenticated;
grant all on listings, listing_rooms, room_thresholds, pricing_periods,
  period_room_rates, offers, listing_leads to service_role;
grant all on all tables in schema public to service_role;

notify pgrst, 'reload schema';
