-- ============================================================
-- findastay — seed: Carl's two Whanganui properties + starter rooms
-- Paste into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: it removes any previous copy of these two first.
-- Properties are seeded UNCLAIMED so they appear on the map with a
-- "claim this business" state — log in as Business to claim them.
-- NOTE: coordinates are approximate central-Whanganui pins — adjust the
-- exact lat/long once the map is live. Room types are a STARTER set;
-- send Carl's real room list (The Avenue has 13) to replace them.
-- ============================================================

begin;

-- clear previous seed of these two (idempotent)
delete from public.properties
where name in ('The Avenue Hotel', 'Aotea Motor Lodge')
  and city = 'Whanganui';

-- ---------- The Avenue Hotel ----------
with avenue as (
  insert into public.properties
    (business_id, name, description, property_type, country, city, area, address,
     latitude, longitude, amenities, registration_status, is_claimed)
  values
    (null,
     'The Avenue Hotel',
     '42-room hotel on Victoria Avenue in central Whanganui, with the Glasshouse Restaurant on site.',
     'hotel', 'NZ', 'Whanganui', 'Central', '379 Victoria Avenue, Whanganui',
     -39.93120000, 175.04860000,
     ARRAY['Free WiFi','On-site restaurant','Bar','Free parking','EV charging','Air conditioning','Guest laundry'],
     'unclaimed', false)
  returning id
)
insert into public.rooms (property_id, name, description, max_adults, max_children, bed_configuration, amenities)
select id, r.name, r.description, r.max_adults, r.max_children, r.bed_configuration, r.amenities
from avenue,
(values
  ('Standard Queen',   'Comfortable queen room for two.',                    2, 0, '1 Queen',            ARRAY['Free WiFi','TV','Tea & coffee','Ensuite']),
  ('Standard Twin',    'Two single beds, ideal for colleagues or friends.',  2, 0, '2 Singles',          ARRAY['Free WiFi','TV','Tea & coffee','Ensuite']),
  ('Superior King',    'Spacious king room with upgraded amenities.',        2, 0, '1 King',             ARRAY['Free WiFi','TV','Tea & coffee','Ensuite','Air conditioning']),
  ('Family Room',      'Queen plus singles for a family of four.',           2, 2, '1 Queen + 2 Singles',ARRAY['Free WiFi','TV','Tea & coffee','Ensuite']),
  ('Executive Suite',  'Separate lounge, premium bedding and workspace.',    2, 0, '1 King',             ARRAY['Free WiFi','TV','Tea & coffee','Ensuite','Air conditioning','Lounge'])
) as r(name, description, max_adults, max_children, bed_configuration, amenities);

-- ---------- Aotea Motor Lodge ----------
with aotea as (
  insert into public.properties
    (business_id, name, description, property_type, country, city, area, address,
     latitude, longitude, amenities, registration_status, is_claimed)
  values
    (null,
     'Aotea Motor Lodge',
     '28-unit motor lodge on Victoria Avenue, Whanganui — self-contained units with kitchens.',
     'motel', 'NZ', 'Whanganui', 'Central', '390 Victoria Avenue, Whanganui',
     -39.93050000, 175.04900000,
     ARRAY['Free WiFi','Free parking','Kitchenette','EV charging','Guest laundry','Spa baths (some units)'],
     'unclaimed', false)
  returning id
)
insert into public.rooms (property_id, name, description, max_adults, max_children, bed_configuration, amenities)
select id, r.name, r.description, r.max_adults, r.max_children, r.bed_configuration, r.amenities
from aotea,
(values
  ('Studio Unit',        'Self-contained studio with kitchenette.',            2, 0, '1 Queen',             ARRAY['Free WiFi','Kitchenette','TV','Ensuite']),
  ('One-Bedroom Unit',   'Separate bedroom plus lounge and kitchen.',          2, 1, '1 Queen + 1 Sofa',    ARRAY['Free WiFi','Kitchen','TV','Ensuite']),
  ('Two-Bedroom Unit',   'Two bedrooms, full kitchen — great for families.',   4, 2, '1 Queen + 2 Singles', ARRAY['Free WiFi','Kitchen','TV','Ensuite','Laundry']),
  ('Spa Studio',         'Studio with private spa bath.',                      2, 0, '1 Queen',             ARRAY['Free WiFi','Kitchenette','Spa bath','TV','Ensuite']),
  ('Accessible Studio',  'Ground-floor accessible studio.',                    2, 0, '1 Queen',             ARRAY['Free WiFi','Kitchenette','Accessible','TV','Ensuite'])
) as r(name, description, max_adults, max_children, bed_configuration, amenities);

commit;

-- quick check
select p.name, p.property_type, p.is_claimed, count(r.id) as room_types
from public.properties p
left join public.rooms r on r.property_id = p.id
where p.city = 'Whanganui'
group by p.name, p.property_type, p.is_claimed;
