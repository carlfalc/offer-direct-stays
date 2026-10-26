-- ============================================================
-- findastay — proper claim gate: business details + required agreements
-- must be captured before a property is claimed/created. Run once in Supabase.
-- ============================================================

alter table fs_listings add column if not exists contact_name   text;
alter table fs_listings add column if not exists business_email  text;
alter table fs_listings add column if not exists business_phone  text;
alter table fs_listings add column if not exists nzbn            text;
alter table fs_listings add column if not exists agreements      jsonb;  -- {terms,liability,security,declaration}
alter table fs_listings add column if not exists agreed_at       timestamptz;

create or replace function fs__all_agreed(a jsonb) returns boolean language sql immutable as $$
  select coalesce((a->>'terms')::boolean,false)
     and coalesce((a->>'liability')::boolean,false)
     and coalesce((a->>'security')::boolean,false)
     and coalesce((a->>'declaration')::boolean,false);
$$;

-- ---------- claim an existing directory property ----------
drop function if exists fs_claim_listing(text,text,text,text,double precision,double precision,text);
create or replace function fs_claim_listing(
  p_hotel_id text, p_name text, p_city text, p_country text,
  p_lat double precision, p_lng double precision, p_thumb text,
  p_contact_name text default null, p_business_email text default null,
  p_business_phone text default null, p_nzbn text default null,
  p_property_type text default null, p_payment_terms text default null,
  p_payment_lead_days int default null, p_agreements jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'You must be signed in to claim a property'; end if;
  if not fs__all_agreed(p_agreements) then
    raise exception 'Please accept the terms, liability, security agreements and the declaration before claiming.';
  end if;

  select owner_id into v_owner from fs_listings where liteapi_hotel_id = p_hotel_id;
  if v_owner is not null and v_owner is distinct from v_uid then
    raise exception 'This property has already been claimed by another account';
  end if;

  insert into fs_listings(
    liteapi_hotel_id, owner_id, status, name, city, country,
    latitude, longitude, thumbnail, claimed_at, approved_at, content_synced_at,
    contact_name, business_email, business_phone, nzbn, property_type,
    payment_terms, payment_lead_days, agreements, agreed_at)
  values (
    p_hotel_id, v_uid, 'active', p_name, p_city, p_country,
    p_lat, p_lng, p_thumb, now(), now(), now(),
    nullif(trim(p_contact_name),''), nullif(trim(p_business_email),''),
    nullif(trim(p_business_phone),''), nullif(trim(p_nzbn),''), p_property_type,
    p_payment_terms, p_payment_lead_days, p_agreements, now())
  on conflict (liteapi_hotel_id) do update set
    owner_id = v_uid, status = 'active',
    name = coalesce(excluded.name, fs_listings.name),
    city = coalesce(excluded.city, fs_listings.city),
    country = coalesce(excluded.country, fs_listings.country),
    latitude = coalesce(excluded.latitude, fs_listings.latitude),
    longitude = coalesce(excluded.longitude, fs_listings.longitude),
    thumbnail = coalesce(excluded.thumbnail, fs_listings.thumbnail),
    claimed_at = coalesce(fs_listings.claimed_at, now()),
    approved_at = now(),
    contact_name = excluded.contact_name,
    business_email = excluded.business_email,
    business_phone = excluded.business_phone,
    nzbn = excluded.nzbn,
    property_type = coalesce(excluded.property_type, fs_listings.property_type),
    payment_terms = coalesce(excluded.payment_terms, fs_listings.payment_terms),
    payment_lead_days = excluded.payment_lead_days,
    agreements = excluded.agreements, agreed_at = now(), updated_at = now()
  returning id into v_id;

  return jsonb_build_object('listing_id', v_id, 'status', 'active');
end $$;
grant execute on function fs_claim_listing(text,text,text,text,double precision,double precision,text,text,text,text,text,text,text,int,jsonb) to authenticated;

-- ---------- create a business not in the directory ----------
drop function if exists fs_create_listing(text,text,text,text,text[],text);
create or replace function fs_create_listing(
  p_name text, p_city text, p_country text, p_address text default null,
  p_payment_methods text[] default '{}', p_payment_note text default null,
  p_contact_name text default null, p_business_email text default null,
  p_business_phone text default null, p_nzbn text default null,
  p_property_type text default null, p_payment_terms text default null,
  p_payment_lead_days int default null, p_agreements jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_hotel text;
begin
  if v_uid is null then raise exception 'You must be signed in'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Business name is required'; end if;
  if not fs__all_agreed(p_agreements) then
    raise exception 'Please accept the terms, liability, security agreements and the declaration before creating your business.';
  end if;

  v_hotel := 'manual:' || gen_random_uuid();
  insert into fs_listings(
    liteapi_hotel_id, owner_id, status, name, city, country, address,
    payment_methods, payment_note, claimed_at, approved_at, content_synced_at,
    contact_name, business_email, business_phone, nzbn, property_type,
    payment_terms, payment_lead_days, agreements, agreed_at)
  values (
    v_hotel, v_uid, 'active', trim(p_name), nullif(trim(p_city),''),
    case when upper(coalesce(p_country,'NZ')) = 'AU' then 'AU' else 'NZ' end,
    nullif(trim(p_address),''), coalesce(p_payment_methods,'{}'), nullif(trim(p_payment_note),''),
    now(), now(), now(),
    nullif(trim(p_contact_name),''), nullif(trim(p_business_email),''),
    nullif(trim(p_business_phone),''), nullif(trim(p_nzbn),''), p_property_type,
    p_payment_terms, p_payment_lead_days, p_agreements, now())
  returning id into v_id;

  return jsonb_build_object('listing_id', v_id, 'hotel_id', v_hotel);
end $$;
grant execute on function fs_create_listing(text,text,text,text,text[],text,text,text,text,text,text,text,int,jsonb) to authenticated;

notify pgrst, 'reload schema';
