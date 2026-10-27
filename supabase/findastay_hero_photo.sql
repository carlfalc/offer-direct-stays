-- ============================================================
-- Main (hero) photo for a listing: an owner-uploaded high-res image plus a
-- focal point (0–100%) so they can frame what shows in the banner crop.
-- Run once in the Supabase SQL editor.
-- ============================================================

alter table fs_listings add column if not exists hero_photo_url text;
alter table fs_listings add column if not exists hero_focus_x   numeric default 50;
alter table fs_listings add column if not exists hero_focus_y   numeric default 50;

notify pgrst, 'reload schema';
