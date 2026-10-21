-- ============================================================
-- PATCH: make findastay notifications null-safe
-- Fixes "null value in column user_id of relation fs_notifications"
-- when an active listing has no business owner linked yet.
-- Run once in the Supabase SQL editor (findastay / tqsqlwmdhqpvidptyrzp).
-- ============================================================

create or replace function fs_notify(p_user uuid, p_offer uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into fs_notifications(user_id, offer_id, kind, title, body)
  select p_user, p_offer, p_kind, p_title, p_body
  where p_user is not null;
$$;
revoke all on function fs_notify(uuid,uuid,text,text,text) from public, anon, authenticated;

notify pgrst, 'reload schema';
