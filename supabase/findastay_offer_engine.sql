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
  -- Null-safe: a missing recipient (e.g. a business listing with no owner linked
  -- yet) must never block the traveller's offer. Skip the row instead of failing.
  insert into fs_notifications(user_id, offer_id, kind, title, body)
  select p_user, p_offer, p_kind, p_title, p_body
  where p_user is not null;
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
