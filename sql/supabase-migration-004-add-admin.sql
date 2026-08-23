-- Run this once to add a lightweight admin system for chat moderation.
-- Only accounts listed in the `admins` table can delete chat messages —
-- everyone else keeps read/post access exactly as before.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A signed-in user can only ever see their own row here — enough for the
-- app to check "am I an admin?" without exposing the admin list to anyone
-- who isn't on it.
create policy "Users can check their own admin status"
  on public.admins for select
  using (auth.uid() = user_id);

-- Admins can delete any chat message — individually, or all at once.
create policy "Admins can delete messages"
  on public.messages for delete
  using (
    exists (
      select 1 from public.admins where admins.user_id = auth.uid()
    )
  );

-- ---------- make yourself an admin ----------
-- 1. Find your user id: Authentication -> Users in the Supabase dashboard,
--    or run:  select id, email from auth.users;
-- 2. Then run this, substituting your own id:
--
--    insert into public.admins (user_id) values ('paste-your-user-id-here');
