-- Arrival details shown to travellers on "Upcoming Trips". Run once in the Supabase SQL editor.
alter table fs_listings add column if not exists check_in_time  text;   -- e.g. '2:00 pm'
alter table fs_listings add column if not exists check_out_time text;   -- e.g. '10:00 am'
alter table fs_listings add column if not exists arrival_notes  text;   -- e.g. 'Key in lockbox, code sent on arrival day'
notify pgrst, 'reload schema';
