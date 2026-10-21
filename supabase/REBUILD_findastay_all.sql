-- ============================================================
-- findastay FULL REBUILD — run once, top to bottom, in the
-- Supabase SQL editor. Safe on a clean slate.
-- Generated 2026-10-21T02:29Z
-- ============================================================


-- ============================================================
-- SECTION: findastay_offers_schema.sql
-- ============================================================
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
grant all on fs_listings, fs_listing_rooms, fs_room_thresholds, fs_pricing_periods,
  fs_period_room_rates, fs_offers, fs_listing_leads to service_role;

-- Defence in depth: a project-wide "grant all to anon" from earlier setup can
-- leak new tables to anon. Shut the private tables at the GRANT layer so anon is
-- denied outright, not just row-filtered by RLS.
revoke all on fs_room_thresholds, fs_pricing_periods, fs_period_room_rates from anon, authenticated;
revoke all on fs_offers from anon;
revoke all on fs_listing_leads from anon, authenticated;

-- Then grant exactly what each role legitimately needs (RLS still gates rows):
grant select on fs_listings, fs_listing_rooms to anon, authenticated;
grant select, insert, update, delete on fs_room_thresholds, fs_pricing_periods,
  fs_period_room_rates to authenticated;   -- RLS restricts to the owning business
grant select, insert, update on fs_offers to authenticated;
grant insert on fs_listing_leads to anon, authenticated;  -- create a lead/nudge, but not read

notify pgrst, 'reload schema';


-- ============================================================
-- SECTION: findastay_lock_private.sql
-- ============================================================
-- findastay — lock private tables at the grant layer (run once).
-- Anon must never read pricing thresholds, seasonal periods, offers or leads.

revoke all on fs_room_thresholds, fs_pricing_periods, fs_period_room_rates from anon, authenticated;
revoke all on fs_offers from anon;
revoke all on fs_listing_leads from anon, authenticated;

-- Re-grant only what each role legitimately needs (RLS still gates the rows):
grant select, insert, update, delete on fs_room_thresholds, fs_pricing_periods,
  fs_period_room_rates to authenticated;      -- RLS restricts to the owning business
grant select, insert, update on fs_offers to authenticated;
grant insert on fs_listing_leads to anon, authenticated;  -- can create a lead, cannot read them

notify pgrst, 'reload schema';


-- ============================================================
-- SECTION: findastay_offer_engine.sql
-- ============================================================
-- =====================================================================
-- findastay — offer engine (RPC functions + pg_cron timers)
-- Run AFTER findastay_offers_schema.sql + findastay_lock_private.sql.
-- Safe to re-run.
--
-- The engine lives in the database so pricing thresholds never touch the
-- browser. The app calls:
--   fs_submit_offer(...)      traveller makes an offer   -> decides auto/route/decline
--   fs_business_respond(...)  business accept/counter/decline
--   fs_confirm_offer(id)      traveller confirms within the hour -> booked
--   fs_withdraw_offer(id)     traveller pulls the offer
-- A pg_cron job runs fs_run_offer_timers() every minute to fire the
-- ~7-min auto-accept release, the 1-hour confirm expiry, and the 24-hour cap.
-- =====================================================================

-- cron needs this flag; add it if the schema predates the engine
alter table fs_offers add column if not exists released_at timestamptz;

-- ---------- notifications (what the app's badge + popups read) ----------
create table if not exists fs_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  offer_id   uuid references fs_offers(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_fs_notifs_user on fs_notifications(user_id, read_at);
alter table fs_notifications enable row level security;
drop policy if exists fs_notifs_read on fs_notifications;
create policy fs_notifs_read on fs_notifications for select using (user_id = auth.uid());
drop policy if exists fs_notifs_update on fs_notifications;
create policy fs_notifs_update on fs_notifications for update using (user_id = auth.uid());
revoke all on fs_notifications from anon;
grant select, update on fs_notifications to authenticated;
grant all on fs_notifications to service_role;

-- ---------- helper: insert a notification ----------
create or replace function fs_notify(p_user uuid, p_offer uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into fs_notifications(user_id, offer_id, kind, title, body)
  values (p_user, p_offer, p_kind, p_title, p_body);
$$;
revoke all on function fs_notify(uuid,uuid,text,text,text) from public, anon, authenticated;

-- ---------- helper: effective guide/auto/floor for a room on a date ----------
-- Applies the matching seasonal period (per-room override first, else % of base).
-- Handles recurs_annually windows, including the Dec->Jan wrap.
-- PRIVATE: returns floor/auto, so it is NEVER granted to clients.
create or replace function fs_effective_rates(p_room uuid, p_date date)
returns table(r_guide numeric, r_auto numeric, r_floor numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_listing uuid; b_guide numeric; b_auto numeric; b_floor numeric;
  per record; ovr record; md text := to_char(p_date,'MM-DD');
begin
  select lr.listing_id, lr.base_guide into v_listing, b_guide
    from fs_listing_rooms lr where lr.id = p_room;
  select rt.base_auto, rt.base_floor into b_auto, b_floor
    from fs_room_thresholds rt where rt.listing_room_id = p_room;

  select p.* into per from fs_pricing_periods p
  where p.listing_id = v_listing
    and (
      (not p.recurs_annually and p_date between p.start_date and p.end_date)
      or (p.recurs_annually and (
        case when to_char(p.start_date,'MM-DD') <= to_char(p.end_date,'MM-DD')
             then md between to_char(p.start_date,'MM-DD') and to_char(p.end_date,'MM-DD')
             else md >= to_char(p.start_date,'MM-DD') or md <= to_char(p.end_date,'MM-DD')
        end))
    )
  order by p.sort_order asc, p.created_at asc
  limit 1;

  if per.id is null then
    r_guide := b_guide; r_auto := b_auto; r_floor := b_floor; return next; return;
  end if;

  select * into ovr from fs_period_room_rates prr
    where prr.period_id = per.id and prr.listing_room_id = p_room;

  if ovr.id is not null then
    r_guide := coalesce(ovr.guide, b_guide);
    r_auto  := coalesce(ovr.auto,  b_auto);
    r_floor := coalesce(ovr.floor, b_floor);
  else
    r_guide := round(b_guide * (1 + per.adjust_sign*per.adjust_pct/100.0), 2);
    r_auto  := case when b_auto  is null then null else round(b_auto *(1 + per.adjust_sign*per.adjust_pct/100.0),2) end;
    r_floor := case when b_floor is null then null else round(b_floor*(1 + per.adjust_sign*per.adjust_pct/100.0),2) end;
  end if;
  return next;
end $$;
revoke all on function fs_effective_rates(uuid,date) from public, anon, authenticated;

-- ---------- traveller submits an offer ----------
create or replace function fs_submit_offer(
  p_room uuid, p_check_in date, p_check_out date,
  p_adults int, p_children int, p_nightly numeric, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_listing uuid; v_auto_on boolean; v_lstatus fs_listing_status; v_owner uuid;
  v_nights int; v_total numeric; v_auto numeric; v_floor numeric;
  v_status fs_offer_status; v_resp fs_responder_kind;
  v_release timestamptz; v_deadline timestamptz; v_id uuid;
  v_traveller uuid := auth.uid();
begin
  if v_traveller is null then raise exception 'You must be signed in to make an offer'; end if;
  select lr.listing_id into v_listing from fs_listing_rooms lr where lr.id = p_room;
  if v_listing is null then raise exception 'Room not found'; end if;
  select l.auto_accept_enabled, l.status, l.owner_id into v_auto_on, v_lstatus, v_owner
    from fs_listings l where l.id = v_listing;
  if v_lstatus <> 'active' then raise exception 'This property is not active on findastay yet'; end if;

  v_nights := (p_check_out - p_check_in);
  if v_nights < 1 then raise exception 'Check-out must be after check-in'; end if;
  v_total := p_nightly * v_nights;

  select r_auto, r_floor into v_auto, v_floor from fs_effective_rates(p_room, p_check_in);

  if v_auto_on and v_auto is not null and p_nightly >= v_auto then
    v_status := 'accepted_pending_confirm'; v_resp := 'auto';
    v_release := now() + interval '7 minutes';         -- human delay before traveller hears
    v_deadline := v_release + interval '1 hour';       -- then 1 hour to confirm
  elsif v_floor is not null and p_nightly < v_floor then
    v_status := 'declined'; v_resp := 'auto';
  else
    v_status := 'pending'; v_resp := null;              -- routes to the business
  end if;

  insert into fs_offers(listing_id, listing_room_id, traveller_id, check_in, check_out, nights,
    adults, children, nightly_offer, total_offer, message, status, responded_by,
    business_responded_at, release_to_traveller_at, confirm_deadline_at)
  values (v_listing, p_room, v_traveller, p_check_in, p_check_out, v_nights,
    coalesce(p_adults,1), coalesce(p_children,0), p_nightly, v_total, p_message, v_status, v_resp,
    case when v_resp = 'auto' then now() else null end, v_release, v_deadline)
  returning id into v_id;

  if v_status = 'pending' then
    perform fs_notify(v_owner, v_id, 'offer_received', 'New offer',
      'A traveller offered $'||p_nightly||'/night for '||v_nights||' night(s). Accept, counter or decline.');
  elsif v_status = 'declined' then
    perform fs_notify(v_traveller, v_id, 'offer_declined', 'Offer not accepted',
      'Your offer was below what this property can take. Try a higher offer.');
  end if;
  -- auto-accept stays quiet until the timer releases it (~7 min), so it never feels robotic

  return jsonb_build_object('offer_id', v_id, 'status', v_status);
end $$;
grant execute on function fs_submit_offer(uuid,date,date,int,int,numeric,text) to authenticated;

-- ---------- business responds to a pending offer ----------
create or replace function fs_business_respond(p_offer uuid, p_action text, p_counter numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid();
begin
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  select owner_id into v_owner from fs_listings where id = o.listing_id;
  if v_owner is distinct from v_uid then raise exception 'This offer is not for your listing'; end if;
  if o.status <> 'pending' then raise exception 'This offer is no longer open'; end if;

  if p_action = 'accept' then
    update fs_offers set status='accepted_pending_confirm', responded_by='business',
      business_responded_at=now(), release_to_traveller_at=now(), released_at=now(),
      confirm_deadline_at=now()+interval '1 hour', updated_at=now() where id=p_offer;
    perform fs_notify(o.traveller_id, p_offer, 'offer_accepted', 'Offer accepted',
      'The property accepted your offer. Confirm within 1 hour to lock it in.');
  elsif p_action = 'counter' then
    if p_counter is null then raise exception 'A counter amount is required'; end if;
    update fs_offers set status='countered', responded_by='business', counter_nightly=p_counter,
      business_responded_at=now(), release_to_traveller_at=now(), released_at=now(),
      confirm_deadline_at=now()+interval '1 hour', updated_at=now() where id=p_offer;
    perform fs_notify(o.traveller_id, p_offer, 'offer_countered', 'Counter-offer',
      'The property countered at $'||p_counter||'/night. Confirm within 1 hour.');
  elsif p_action = 'decline' then
    update fs_offers set status='declined', responded_by='business',
      business_responded_at=now(), updated_at=now() where id=p_offer;
    perform fs_notify(o.traveller_id, p_offer, 'offer_declined', 'Offer declined',
      'The property passed on your offer this time.');
  else
    raise exception 'Unknown action: %', p_action;
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function fs_business_respond(uuid,text,numeric) to authenticated;

-- ---------- traveller confirms (turns an acceptance into a booking) ----------
create or replace function fs_confirm_offer(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  if o.traveller_id is distinct from v_uid then raise exception 'This is not your offer'; end if;
  if o.status not in ('accepted_pending_confirm','countered') then
    raise exception 'There is nothing to confirm on this offer'; end if;
  if o.confirm_deadline_at is not null and now() > o.confirm_deadline_at then
    raise exception 'This offer has expired'; end if;

  update fs_offers set status='confirmed', confirmed_at=now(), updated_at=now() where id=p_offer;
  select owner_id into v_owner from fs_listings where id=o.listing_id;
  perform fs_notify(v_owner, p_offer, 'offer_confirmed', 'Booking confirmed',
    'The guest confirmed. The booking is locked in — details are in your dashboard.');
  perform fs_notify(o.traveller_id, p_offer, 'offer_confirmed', 'You''re booked',
    'Your stay is confirmed. Details are in your trips.');
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end $$;
grant execute on function fs_confirm_offer(uuid) to authenticated;

-- ---------- traveller withdraws ----------
create or replace function fs_withdraw_offer(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  if o.traveller_id is distinct from v_uid then raise exception 'This is not your offer'; end if;
  if o.status not in ('pending','accepted_pending_confirm','countered') then
    raise exception 'This offer can no longer be withdrawn'; end if;
  update fs_offers set status='withdrawn', updated_at=now() where id=p_offer;
  return jsonb_build_object('ok', true, 'status', 'withdrawn');
end $$;
grant execute on function fs_withdraw_offer(uuid) to authenticated;

-- lock all action RPCs to signed-in users (Postgres grants EXECUTE to PUBLIC by default)
revoke all on function fs_submit_offer(uuid,date,date,int,int,numeric,text) from public, anon;
revoke all on function fs_business_respond(uuid,text,numeric) from public, anon;
revoke all on function fs_confirm_offer(uuid) from public, anon;
revoke all on function fs_withdraw_offer(uuid) from public, anon;

-- ---------- the timer worker (pg_cron runs this every minute) ----------
create or replace function fs_run_offer_timers()
returns void language plpgsql security definer set search_path = public as $$
declare r fs_offers; v_owner uuid;
begin
  -- 1) release due auto-accepts (the ~7-min human delay elapsed)
  for r in select * from fs_offers
    where status='accepted_pending_confirm' and responded_by='auto'
      and released_at is null and release_to_traveller_at <= now()
  loop
    update fs_offers set released_at=now(), updated_at=now() where id=r.id;
    select owner_id into v_owner from fs_listings where id=r.listing_id;
    perform fs_notify(r.traveller_id, r.id, 'offer_accepted', 'Offer accepted',
      'Your offer of $'||r.nightly_offer||'/night was accepted. Confirm within 1 hour to lock it in.');
    perform fs_notify(v_owner, r.id, 'offer_auto_accepted', 'findastay AI accepted an offer',
      'An offer cleared your auto-accept price — we booked it and notified the guest. Nothing to do.');
  end loop;

  -- 2) expire acceptances the traveller didn't confirm in time (1-hour window)
  for r in select * from fs_offers
    where status in ('accepted_pending_confirm','countered') and confirm_deadline_at <= now()
  loop
    update fs_offers set status='expired', expired_at=now(), updated_at=now() where id=r.id;
    select owner_id into v_owner from fs_listings where id=r.listing_id;
    perform fs_notify(v_owner, r.id, 'offer_expired', 'Previously accepted offer cancelled',
      'The guest didn''t confirm in time, so the hold was released.');
    perform fs_notify(r.traveller_id, r.id, 'offer_expired', 'Held rate expired',
      'You didn''t confirm within the hour, so the rate was released.');
  end loop;

  -- 3) 24-hour cap on offers a business never answered
  for r in select * from fs_offers where status='pending' and overall_expires_at <= now()
  loop
    update fs_offers set status='expired', expired_at=now(), updated_at=now() where id=r.id;
    select owner_id into v_owner from fs_listings where id=r.listing_id;
    perform fs_notify(r.traveller_id, r.id, 'offer_expired', 'Offer expired',
      'No response within 24 hours, so your offer closed.');
    perform fs_notify(v_owner, r.id, 'offer_expired', 'Offer expired',
      'An offer closed after 24 hours with no response.');
  end loop;
end $$;
revoke all on function fs_run_offer_timers() from public, anon, authenticated;

-- ---------- schedule the timer every minute (pg_cron) ----------
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('fs-offer-timers'); exception when others then null; end $$;
select cron.schedule('fs-offer-timers', '* * * * *', 'select fs_run_offer_timers();');

notify pgrst, 'reload schema';


-- ============================================================
-- SECTION: findastay_engine_security_patch.sql
-- ============================================================
-- findastay — offer engine security patch (run once, after the engine file).
-- 1) null-safe ownership checks in confirm/withdraw
-- 2) remove default PUBLIC execute so only signed-in users can call the RPCs

create or replace function fs_confirm_offer(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  if o.traveller_id is distinct from v_uid then raise exception 'This is not your offer'; end if;
  if o.status not in ('accepted_pending_confirm','countered') then
    raise exception 'There is nothing to confirm on this offer'; end if;
  if o.confirm_deadline_at is not null and now() > o.confirm_deadline_at then
    raise exception 'This offer has expired'; end if;

  update fs_offers set status='confirmed', confirmed_at=now(), updated_at=now() where id=p_offer;
  select owner_id into v_owner from fs_listings where id=o.listing_id;
  perform fs_notify(v_owner, p_offer, 'offer_confirmed', 'Booking confirmed',
    'The guest confirmed. The booking is locked in — details are in your dashboard.');
  perform fs_notify(o.traveller_id, p_offer, 'offer_confirmed', 'You''re booked',
    'Your stay is confirmed. Details are in your trips.');
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end $$;

create or replace function fs_withdraw_offer(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  if o.traveller_id is distinct from v_uid then raise exception 'This is not your offer'; end if;
  if o.status not in ('pending','accepted_pending_confirm','countered') then
    raise exception 'This offer can no longer be withdrawn'; end if;
  update fs_offers set status='withdrawn', updated_at=now() where id=p_offer;
  return jsonb_build_object('ok', true, 'status', 'withdrawn');
end $$;

-- lock all action RPCs to signed-in users only
revoke all on function fs_submit_offer(uuid,date,date,int,int,numeric,text) from public, anon;
revoke all on function fs_business_respond(uuid,text,numeric) from public, anon;
revoke all on function fs_confirm_offer(uuid) from public, anon;
revoke all on function fs_withdraw_offer(uuid) from public, anon;
grant execute on function fs_submit_offer(uuid,date,date,int,int,numeric,text) to authenticated;
grant execute on function fs_business_respond(uuid,text,numeric) to authenticated;
grant execute on function fs_confirm_offer(uuid) to authenticated;
grant execute on function fs_withdraw_offer(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ============================================================
-- SECTION: seed_aotea_active.sql
-- ============================================================
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


-- ============================================================
-- SECTION: seed_aotea_rooms.sql
-- ============================================================
-- Seed Aotea Motor Lodge's rooms + price thresholds into the findastay engine tables,
-- so Make an Offer can run auto-accept / route / decline against real numbers.
-- Prices here are EXAMPLES — Carl adjusts them later in the Rates & Auto-Accept editor.
-- Safe to re-run.

with l as (
  select id from fs_listings where liteapi_hotel_id = 'lp543c0'
),
r(liteapi_room_id, room_name, occ, ad, ch, guide, auto, floorp) as (
  values
    ('3379853',   'Executive One-Bedroom Suite', 4, 4, 3, 259, 219, 189),
    ('3379854',   'Executive Studio',            2, 2, 1, 219, 189, 159),
    ('3379852',   'Deluxe Studio',               2, 2, 1, 209, 179, 155),
    ('3379855',   'Deluxe Twin Studio',          3, 3, 2, 219, 189, 159),
    ('3379856',   'Deluxe One-Bedroom Suite',    4, 4, 3, 259, 219, 189),
    ('1459536300','Deluxe Room, 1 Bedroom',      4, 4, 3, 249, 209, 179),
    ('1459536301','Executive Room, 1 Bedroom',   4, 4, 3, 249, 209, 179),
    ('3379857',   'Special Offer - Deluxe Studio',2,2, 1, 199, 169, 149)
)
insert into fs_listing_rooms
  (listing_id, liteapi_room_id, room_name, max_occupancy, max_adults, max_children, base_guide, currency)
select l.id, r.liteapi_room_id, r.room_name, r.occ, r.ad, r.ch, r.guide, 'NZD'
from l cross join r
on conflict (listing_id, liteapi_room_id) do update
  set room_name = excluded.room_name,
      max_occupancy = excluded.max_occupancy,
      max_adults = excluded.max_adults,
      max_children = excluded.max_children,
      base_guide = excluded.base_guide;

-- thresholds (private: auto-accept + floor)
with l as (
  select id from fs_listings where liteapi_hotel_id = 'lp543c0'
),
r(liteapi_room_id, auto, floorp) as (
  values
    ('3379853', 219, 189),
    ('3379854', 189, 159),
    ('3379852', 179, 155),
    ('3379855', 189, 159),
    ('3379856', 219, 189),
    ('1459536300', 209, 179),
    ('1459536301', 209, 179),
    ('3379857', 169, 149)
)
insert into fs_room_thresholds (listing_room_id, base_auto, base_floor)
select lr.id, r.auto, r.floorp
from fs_listing_rooms lr
join l on lr.listing_id = l.id
join r on r.liteapi_room_id = lr.liteapi_room_id
on conflict (listing_room_id) do update
  set base_auto = excluded.base_auto,
      base_floor = excluded.base_floor;

notify pgrst, 'reload schema';


-- Refresh PostgREST so the API sees the new tables & functions
notify pgrst, 'reload schema';
