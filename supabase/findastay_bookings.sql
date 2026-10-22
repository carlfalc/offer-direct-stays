-- ============================================================
-- findastay bookings: unique booking numbers (FS-1042-0001),
-- assigned when a traveller confirms, plus "mark as entered".
-- Run once in the Supabase SQL editor (findastay project).
-- ============================================================

-- Each business (listing owner) gets a platform number once; each of its
-- bookings appends a 4-digit sequence. Numbers never repeat.
create sequence if not exists fs_platform_code_seq start 1042;

create table if not exists fs_business_counters (
  owner_id      uuid primary key references auth.users(id),
  platform_code int  unique not null default nextval('fs_platform_code_seq'),
  booking_seq   int  not null default 0
);
alter table fs_business_counters enable row level security;
revoke all on fs_business_counters from anon, authenticated;   -- functions only

-- Booking fields on the offer (an offer becomes a booking on confirm)
alter table fs_offers add column if not exists booking_number text unique;
alter table fs_offers add column if not exists entered_at    timestamptz;
alter table fs_offers add column if not exists entered_by    uuid references auth.users(id);

-- Next booking number for a given owner: FS-<platform>-<4 digit seq>
create or replace function fs_next_booking_number(p_owner uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code int; v_seq int;
begin
  if p_owner is null then return null; end if;
  insert into fs_business_counters(owner_id) values (p_owner)
    on conflict (owner_id) do nothing;
  update fs_business_counters set booking_seq = booking_seq + 1
    where owner_id = p_owner
    returning platform_code, booking_seq into v_code, v_seq;
  return 'FS-' || v_code || '-' || lpad(v_seq::text, 4, '0');
end $$;
revoke all on function fs_next_booking_number(uuid) from public, anon, authenticated;

-- Confirm now also assigns the booking number and puts it in both notifications.
create or replace function fs_confirm_offer(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid(); v_bn text;
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  if o.traveller_id is distinct from v_uid then raise exception 'This is not your offer'; end if;
  if o.status not in ('accepted_pending_confirm','countered') then
    raise exception 'There is nothing to confirm on this offer'; end if;
  if o.confirm_deadline_at is not null and now() > o.confirm_deadline_at then
    raise exception 'This offer has expired'; end if;

  select owner_id into v_owner from fs_listings where id = o.listing_id;
  v_bn := coalesce(o.booking_number, fs_next_booking_number(v_owner));

  update fs_offers set status='confirmed', confirmed_at=now(), booking_number=v_bn, updated_at=now()
    where id = p_offer;
  perform fs_notify(v_owner, p_offer, 'offer_confirmed', 'Booking confirmed',
    'The guest confirmed booking '||coalesce(v_bn,'')||'. Enter it in your system, then mark it entered.');
  perform fs_notify(o.traveller_id, p_offer, 'offer_confirmed', 'You''re booked',
    'Your stay is confirmed. Booking reference '||coalesce(v_bn,'(pending)')||'.');
  return jsonb_build_object('ok', true, 'status', 'confirmed', 'booking_number', v_bn);
end $$;
revoke all on function fs_confirm_offer(uuid) from public, anon;
grant execute on function fs_confirm_offer(uuid) to authenticated;

-- Business marks a confirmed booking as entered into their own system.
create or replace function fs_mark_entered(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Booking not found'; end if;
  select owner_id into v_owner from fs_listings where id = o.listing_id;
  if v_owner is distinct from v_uid then raise exception 'This booking is not for your listing'; end if;
  if o.status <> 'confirmed' then raise exception 'Only confirmed bookings can be marked entered'; end if;
  update fs_offers set entered_at = now(), entered_by = v_uid, updated_at = now() where id = p_offer;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function fs_mark_entered(uuid) from public, anon;
grant execute on function fs_mark_entered(uuid) to authenticated;

notify pgrst, 'reload schema';
