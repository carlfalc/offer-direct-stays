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
