-- ============================================================
-- Does an email belong to a business account (owns a findastay listing)?
-- Used on sign-up so a business email can't be re-used for a personal account
-- and the message can say so. SECURITY DEFINER to read auth.users.
-- Run once in the Supabase SQL editor.
-- ============================================================

create or replace function fs_email_is_business(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from fs_listings l
    join auth.users u on u.id = l.owner_id
    where lower(u.email) = lower(trim(p_email))
  );
$$;

grant execute on function fs_email_is_business(text) to anon, authenticated;

notify pgrst, 'reload schema';
