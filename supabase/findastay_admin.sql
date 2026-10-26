-- ============================================================
-- findastay — admin console access + make yourself an admin.
-- Self-contained: creates the admin table/function if missing, sets the
-- read policies, then makes you an admin. Run once in the Supabase SQL editor.
-- ============================================================

-- 1) Admin allowlist table + helper (idempotent) ------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users au where au.user_id = auth.uid());
$$;

-- NB: use is_admin() (SECURITY DEFINER, bypasses RLS) here — a subquery back to
-- admin_users in this policy causes infinite recursion (42P17).
drop policy if exists "Admins can view admin users" on public.admin_users;
create policy "Admins can view admin users" on public.admin_users for select
  using (public.is_admin());

-- 2) Admin read/update access to the console tables ---------------------------
drop policy if exists fs_onboarding_admin_read   on fs_onboarding_requests;
create policy fs_onboarding_admin_read   on fs_onboarding_requests for select using (public.is_admin());
drop policy if exists fs_onboarding_admin_update on fs_onboarding_requests;
create policy fs_onboarding_admin_update on fs_onboarding_requests for update using (public.is_admin());
grant select, update on fs_onboarding_requests to authenticated;   -- RLS still limits rows to admins

drop policy if exists fs_leads_admin_read on fs_listing_leads;
create policy fs_leads_admin_read on fs_listing_leads for select using (public.is_admin());
grant select on fs_listing_leads to authenticated;                 -- RLS still limits rows to admins

drop policy if exists fs_offers_admin_read on fs_offers;
create policy fs_offers_admin_read on fs_offers for select using (public.is_admin());

notify pgrst, 'reload schema';

-- 3) Make YOURSELF an admin ---------------------------------------------------
-- This is set to your Claude account email. If you log in to findastay with a
-- DIFFERENT email, change it below before running. You must have signed in to
-- findastay at least once so the account exists in auth.users.
insert into public.admin_users(user_id)
  select id from auth.users where lower(email) = lower('falconercarlandrew@gmail.com')
  on conflict (user_id) do nothing;

do $$
declare v int;
begin
  select count(*) into v from public.admin_users;
  raise notice 'admin_users now has % row(s).', v;
end $$;
