-- ============================================================
-- findastay — capture the guest's contact details on every offer so the
-- property can book them in once confirmed. Run once in Supabase.
-- ============================================================

alter table fs_offers add column if not exists guest_email        text;
alter table fs_offers add column if not exists guest_phone        text;
alter table fs_offers add column if not exists guest_contact_pref text;  -- 'phone' | 'text' | 'email'

-- Replace fs_submit_offer with a version that also stores contact details.
drop function if exists fs_submit_offer(uuid,date,date,int,int,numeric,text);

create or replace function fs_submit_offer(
  p_room uuid, p_check_in date, p_check_out date,
  p_adults int, p_children int, p_nightly numeric, p_message text default null,
  p_email text default null, p_phone text default null, p_contact_pref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_listing uuid; v_auto_on boolean; v_lstatus fs_listing_status; v_owner uuid;
  v_nights int; v_total numeric; v_auto numeric; v_floor numeric;
  v_status fs_offer_status; v_resp fs_responder_kind;
  v_release timestamptz; v_deadline timestamptz; v_id uuid;
  v_traveller uuid := auth.uid();
  v_email text;
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

  -- Contact email: use what the guest gave, else fall back to their account email.
  v_email := coalesce(nullif(trim(p_email), ''), (select email from auth.users where id = v_traveller));

  select r_auto, r_floor into v_auto, v_floor from fs_effective_rates(p_room, p_check_in);

  if v_auto_on and v_auto is not null and p_nightly >= v_auto then
    v_status := 'accepted_pending_confirm'; v_resp := 'auto';
    v_release := now() + interval '7 minutes';
    v_deadline := v_release + interval '1 hour';
  elsif v_floor is not null and p_nightly < v_floor then
    v_status := 'declined'; v_resp := 'auto';
  else
    v_status := 'pending'; v_resp := null;
  end if;

  insert into fs_offers(listing_id, listing_room_id, traveller_id, check_in, check_out, nights,
    adults, children, nightly_offer, total_offer, message, status, responded_by,
    business_responded_at, release_to_traveller_at, confirm_deadline_at,
    guest_email, guest_phone, guest_contact_pref)
  values (v_listing, p_room, v_traveller, p_check_in, p_check_out, v_nights,
    coalesce(p_adults,1), coalesce(p_children,0), p_nightly, v_total, p_message, v_status, v_resp,
    case when v_resp = 'auto' then now() else null end, v_release, v_deadline,
    v_email, nullif(trim(p_phone), ''), nullif(trim(p_contact_pref), ''))
  returning id into v_id;

  if v_status = 'pending' then
    perform fs_notify(v_owner, v_id, 'offer_received', 'New offer',
      'A traveller offered $'||p_nightly||'/night for '||v_nights||' night(s). Accept, counter or decline.');
  elsif v_status = 'declined' then
    perform fs_notify(v_traveller, v_id, 'offer_declined', 'Offer not accepted',
      'Your offer was below what this property can take. Try a higher offer.');
  end if;

  return jsonb_build_object('offer_id', v_id, 'status', v_status);
end $$;

grant execute on function fs_submit_offer(uuid,date,date,int,int,numeric,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
