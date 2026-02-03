-- Add admin user by email
insert into public.admin_users (user_id)
select id from auth.users where email = 'askteamonline@gmail.com'
on conflict do nothing;
