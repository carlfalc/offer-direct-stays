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
