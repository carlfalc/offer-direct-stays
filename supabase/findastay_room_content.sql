-- findastay — room/unit content editor support
-- Curated photos, overview, amenities, bed config, and owner-added custom units.
-- Run this whole file in the Supabase SQL editor.

-- 1. Content columns on fs_listing_rooms -----------------------------------
--    photos: ordered array [{ "url": "...", "source": "liteapi" | "upload" }]
--            (first entry is the cover). Empty = fall back to LiteAPI feed.
alter table fs_listing_rooms add column if not exists photos            jsonb   not null default '[]'::jsonb;
alter table fs_listing_rooms add column if not exists description       text;   -- owner overview / override
alter table fs_listing_rooms add column if not exists amenities         text;   -- free-type amenities list
alter table fs_listing_rooms add column if not exists bed_configuration text;
alter table fs_listing_rooms add column if not exists is_custom         boolean not null default false;

-- Owner-added units have no LiteAPI id; allow it to be null.
alter table fs_listing_rooms alter column liteapi_room_id drop not null;

-- 2. Storage bucket for owner-uploaded room photos -------------------------
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;

-- Public read; authenticated owners can upload/replace/remove.
-- (v1: any authenticated user may write to the bucket; paths are namespaced by
--  listing + room id. Tighten to per-owner path checks later if needed.)
drop policy if exists "room-photos public read"   on storage.objects;
drop policy if exists "room-photos auth insert"   on storage.objects;
drop policy if exists "room-photos auth update"   on storage.objects;
drop policy if exists "room-photos auth delete"   on storage.objects;

create policy "room-photos public read" on storage.objects
  for select using (bucket_id = 'room-photos');
create policy "room-photos auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'room-photos');
create policy "room-photos auth update" on storage.objects
  for update to authenticated using (bucket_id = 'room-photos');
create policy "room-photos auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'room-photos');
