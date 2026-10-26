-- ============================================================
-- findastay — property payment methods + manual business creation.
-- Run once in Supabase SQL editor.
-- ============================================================

-- Accepted ways a property takes the stay payment (editable anytime by the owner).
-- Values: 'bank_transfer' | 'pay_on_arrival' | 'card_property' | 'payment_link'
alter table fs_listings add column if not exists payment_methods text[] not null default '{}';
alter table fs_listings add column if not exists payment_note    text;
alter table fs_listings add column if not exists address         text;

-- Create a business that isn't in the LiteAPI directory (owner-only).
create or replace function fs_create_listing(
  p_name text, p_city text, p_country text, p_address text default null,
  p_payment_methods text[] default '{}', p_payment_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_hotel text;
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Business name is required'; end if;

  v_hotel := 'manual:' || gen_random_uuid();

  insert into fs_listings(
    liteapi_hotel_id, owner_id, status, name, city, country, address,
    payment_methods, payment_note, claimed_at, approved_at, content_synced_at)
  values (
    v_hotel, v_uid, 'active', trim(p_name), nullif(trim(p_city), ''),
    case when upper(coalesce(p_country,'NZ')) = 'AU' then 'AU' else 'NZ' end,
    nullif(trim(p_address), ''),
    coalesce(p_payment_methods, '{}'), nullif(trim(p_payment_note), ''),
    now(), now(), now())
  returning id into v_id;

  return jsonb_build_object('listing_id', v_id, 'hotel_id', v_hotel);
end $$;

grant execute on function fs_create_listing(text,text,text,text,text[],text) to authenticated;

notify pgrst, 'reload schema';
