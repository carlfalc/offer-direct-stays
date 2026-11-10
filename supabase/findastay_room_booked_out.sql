-- "Room booked out" options for the business: offer a different room, or decline as unavailable.
-- Run once in the Supabase SQL editor.

alter table fs_offers add column if not exists original_room_id uuid references fs_listing_rooms(id);
alter table fs_offers add column if not exists alt_note text;

-- Offer an alternative room at a price (the guest gets 1 hour to confirm, like a counter).
create or replace function fs_business_offer_alternative(p_offer uuid, p_room uuid, p_nightly numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid(); v_room_listing uuid; v_room_name text;
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  select owner_id into v_owner from fs_listings where id = o.listing_id;
  if v_owner is distinct from v_uid then raise exception 'This offer is not for your listing'; end if;
  if o.status <> 'pending' then raise exception 'This offer is no longer open'; end if;
  if p_nightly is null or p_nightly <= 0 then raise exception 'A nightly price is required'; end if;
  select listing_id, room_name into v_room_listing, v_room_name from fs_listing_rooms where id = p_room;
  if v_room_listing is distinct from o.listing_id then raise exception 'That room is not part of this property'; end if;

  update fs_offers set
    original_room_id = coalesce(original_room_id, listing_room_id),
    listing_room_id = p_room,
    status = 'countered', responded_by = 'business', counter_nightly = p_nightly,
    alt_note = p_note,
    business_responded_at = now(), release_to_traveller_at = now(), released_at = now(),
    confirm_deadline_at = now() + interval '1 hour', updated_at = now()
  where id = p_offer;

  perform fs_notify(o.traveller_id, p_offer, 'offer_alternative', 'Another room is available',
    'Sorry, that room is not available. The property can offer '||coalesce(v_room_name,'another room')||' at $'||p_nightly||'/night. Confirm within 1 hour.');
  return jsonb_build_object('ok', true);
end $$;

-- Decline because the room is booked out.
create or replace function fs_business_decline_unavailable(p_offer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o fs_offers; v_owner uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  select * into o from fs_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found'; end if;
  select owner_id into v_owner from fs_listings where id = o.listing_id;
  if v_owner is distinct from v_uid then raise exception 'This offer is not for your listing'; end if;
  if o.status <> 'pending' then raise exception 'This offer is no longer open'; end if;
  update fs_offers set status='declined', responded_by='business', alt_note='Room booked out',
    business_responded_at=now(), updated_at=now() where id = p_offer;
  perform fs_notify(o.traveller_id, p_offer, 'offer_declined', 'Room not available',
    'Sorry, that room is booked out for your dates. Try other dates or another property.');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function fs_business_offer_alternative(uuid,uuid,numeric,text) from public, anon;
revoke all on function fs_business_decline_unavailable(uuid) from public, anon;
grant execute on function fs_business_offer_alternative(uuid,uuid,numeric,text) to authenticated;
grant execute on function fs_business_decline_unavailable(uuid) to authenticated;

notify pgrst, 'reload schema';
