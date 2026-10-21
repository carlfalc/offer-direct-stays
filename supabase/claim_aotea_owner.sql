-- ============================================================
-- Link Aotea to YOU as the business owner + null-safe notifications.
-- Run once in the Supabase SQL editor (findastay / tqsqlwmdhqpvidptyrzp).
-- ============================================================

-- 1) Null-safe notifications (defensive: a missing owner must never block an offer)
create or replace function fs_notify(p_user uuid, p_offer uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into fs_notifications(user_id, offer_id, kind, title, body)
  select p_user, p_offer, p_kind, p_title, p_body
  where p_user is not null;
$$;
revoke all on function fs_notify(uuid,uuid,text,text,text) from public, anon, authenticated;

-- 2) Make YOUR account the owner of Aotea.
--    >>> Replace the email below with the one you LOG IN WITH. <<<
update fs_listings
set owner_id = (select id from auth.users where lower(email) = lower('REPLACE_WITH_YOUR_LOGIN_EMAIL')),
    auto_accept_enabled = true
where liteapi_hotel_id = 'lp543c0';

-- 3) Confirmation — tells you if the email matched an account
do $$
declare v uuid;
begin
  select owner_id into v from fs_listings where liteapi_hotel_id = 'lp543c0';
  if v is null then
    raise notice 'OWNER NOT SET — no account matched that email. Fix the email in step 2 and re-run.';
  else
    raise notice 'OWNER SET OK — Aotea is now owned by %', v;
  end if;
end $$;

notify pgrst, 'reload schema';
