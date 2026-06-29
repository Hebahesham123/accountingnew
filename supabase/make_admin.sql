-- Promote a user to admin by email (run in Supabase SQL Editor).
-- The user must have signed up at least once (so a profiles row exists).
update public.profiles
set role = 'admin'
where email = 'abdelrahman@admin.local';   -- <-- change to the email you want

-- See all users and their roles:
-- select email, role, full_name from public.profiles order by created_at;
