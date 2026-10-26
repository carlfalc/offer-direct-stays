-- ============================================================
-- findastay — messenger. One thread per CONFIRMED offer.
-- Traveller + property owner can talk; admins can read all.
-- Opens only on confirmation; locks 10 days after checkout.
-- Card numbers are blocked at the database. Run once in Supabase.
-- ============================================================

-- 0) Admin helper (idempotent — safe if already created elsewhere) -----------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users au where au.user_id = auth.uid());
$$;

-- 1) Tables -------------------------------------------------------------------
create table if not exists fs_messages (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references fs_offers(id) on delete cascade,
  sender_id  uuid references auth.users(id),      -- null = system message
  kind       text not null default 'user',        -- 'user' | 'system'
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_fs_messages_offer on fs_messages(offer_id, created_at);

create table if not exists fs_thread_reads (
  offer_id     uuid not null references fs_offers(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);

alter table fs_messages     enable row level security;
alter table fs_thread_reads enable row level security;

-- 2) Participant check: traveller on the offer, or owner of its listing ------
create or replace function fs_offer_participant(p_offer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from fs_offers o
    join fs_listings l on l.id = o.listing_id
    where o.id = p_offer
      and (o.traveller_id = auth.uid() or l.owner_id = auth.uid())
  );
$$;

-- 3) Policies -----------------------------------------------------------------
drop policy if exists fs_messages_read on fs_messages;
create policy fs_messages_read on fs_messages for select using (fs_offer_participant(offer_id));

-- Insert: sender is self, user-kind only, thread open (confirmed) & not locked
-- (<= 10 days after checkout). Participants only.
drop policy if exists fs_messages_insert on fs_messages;
create policy fs_messages_insert on fs_messages for insert with check (
  sender_id = auth.uid()
  and kind = 'user'
  and exists (
    select 1 from fs_offers o
    join fs_listings l on l.id = o.listing_id
    where o.id = offer_id
      and (o.traveller_id = auth.uid() or l.owner_id = auth.uid())
      and o.status = 'confirmed'
      and (o.check_out + interval '10 days') >= now()::date
  )
);

drop policy if exists fs_reads_rw on fs_thread_reads;
create policy fs_reads_rw on fs_thread_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert on fs_messages to authenticated;
grant select, insert, update on fs_thread_reads to authenticated;

-- 4) Block card numbers at the DB (13–19 digits, ignoring spaces/dashes) ------
create or replace function fs_block_card_numbers()
returns trigger language plpgsql as $$
declare cleaned text;
begin
  cleaned := regexp_replace(coalesce(new.body, ''), '[\s\-]', '', 'g');
  if cleaned ~ '\d{13,19}' then
    raise exception 'For your security, card numbers can''t be sent in messages. Pay the property by their listed method.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_fs_block_cards on fs_messages;
create trigger trg_fs_block_cards before insert on fs_messages
  for each row execute function fs_block_card_numbers();

-- 5) Notify the OTHER participant on a new user message -----------------------
create or replace function fs_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_trav uuid; v_owner uuid; v_recipient uuid;
begin
  if new.kind <> 'user' then return new; end if;
  select o.traveller_id, l.owner_id into v_trav, v_owner
    from fs_offers o join fs_listings l on l.id = o.listing_id
    where o.id = new.offer_id;
  v_recipient := case when new.sender_id = v_trav then v_owner else v_trav end;
  if v_recipient is not null then
    insert into fs_notifications(user_id, kind, title, body)
    values (v_recipient, 'message', 'New message', 'You have a new message about your booking.');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_fs_notify_message on fs_messages;
create trigger trg_fs_notify_message after insert on fs_messages
  for each row execute function fs_notify_message();

-- 6) Realtime (so the thread updates live) ------------------------------------
do $$ begin
  alter publication supabase_realtime add table fs_messages;
exception when others then null; end $$;

notify pgrst, 'reload schema';
