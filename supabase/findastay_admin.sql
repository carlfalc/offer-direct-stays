-- ============================================================
-- Admin console read-access + make yourself an admin.
-- Admins are rows in public.admin_users; public.is_admin() checks it.
-- Run once in the Supabase SQL editor (findastay project).
-- ============================================================

-- Onboarding requests: admins read + update status
drop policy if exists fs_onboarding_admin_read on fs_onboarding_requests;
create policy fs_onboarding_admin_read on fs_onboarding_requests for select using (public.is_admin());
drop policy if exists fs_onboarding_admin_update on fs_onboarding_requests;
create policy fs_onboarding_admin_update on fs_onboarding_requests for update using (public.is_admin());
grant select, update on fs_onboarding_requests to authenticated;  -- RLS still limits rows to admins

-- Claim / nudge leads: admins read
drop policy if exists fs_leads_admin_read on fs_listing_leads;
create policy fs_leads_admin_read on fs_listing_leads for select using (public.is_admin());
grant select on fs_listing_leads to authenticated;                -- RLS still limits rows to admins

-- Offers/bookings: admins can read all (for the all-bookings view)
drop policy if exists fs_offers_admin_read on fs_offers;
create policy fs_offers_admin_read on fs_offers for select using (public.is_admin());

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Make YOURSELF an admin: replace the email with the one you log in with,
-- then run this block.
-- ------------------------------------------------------------
insert into public.admin_users(user_id)
  select id from auth.users where lower(email) = lower('REPLACE_WITH_YOUR_LOGIN_EMAIL')
  on conflict (user_id) do nothing;

do $$
declare v int;
begin
  select count(*) into v from public.admin_users;
  raise notice 'admin_users now has % row(s).', v;
end $$;
