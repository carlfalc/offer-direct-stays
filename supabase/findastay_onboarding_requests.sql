-- ============================================================
-- findastay: business onboarding requests (for businesses not in the
-- directory / brand-new ones). Anyone can submit; only the platform
-- admin (service_role) can read them. Run once in the SQL editor.
-- ============================================================

create table if not exists fs_onboarding_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),   -- set if they were signed in
  contact_name  text,
  email         text not null,
  phone         text,
  business_name text,
  company       text,
  role          text,
  message       text,
  status        text not null default 'new',       -- new | contacted | done
  created_at    timestamptz not null default now()
);

alter table fs_onboarding_requests enable row level security;

-- Anyone can submit an onboarding request…
drop policy if exists fs_onboarding_insert on fs_onboarding_requests;
create policy fs_onboarding_insert on fs_onboarding_requests for insert with check (true);

-- …but nobody but the admin (service_role) can read them.
revoke all on fs_onboarding_requests from anon, authenticated;
grant insert on fs_onboarding_requests to anon, authenticated;
grant all on fs_onboarding_requests to service_role;

notify pgrst, 'reload schema';
