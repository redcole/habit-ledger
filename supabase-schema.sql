-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor).
-- It creates all tables this app needs and locks each one down with
-- row-level security appropriate to what it's for.

-- ---------- habits ----------

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  completions jsonb not null default '{}'::jsonb,
  position integer,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits(user_id);

alter table public.habits enable row level security;

create policy "Users can view their own habits"
  on public.habits for select
  using (auth.uid() = user_id);

-- Anyone (including signed-out visitors) can see a habit flagged public —
-- this is what powers /u/<username> profile pages.
create policy "Public habits are viewable by anyone"
  on public.habits for select
  using (is_public = true);

create policy "Users can insert their own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on public.habits for update
  using (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on public.habits for delete
  using (auth.uid() = user_id);

-- ---------- profiles (real name shown instead of email) ----------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-z0-9-]{3,24}$')
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- A profile becomes publicly visible once its owner claims a username —
-- that's the actual "opt in to being discoverable" moment.
create policy "Public profiles are viewable by anyone"
  on public.profiles for select
  using (username is not null);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Auto-create a profile row on signup, seeded from the full name entered
-- on the sign-up form (sent as auth metadata by src/Auth.jsx).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- admin (chat moderation) ----------
-- Created before `messages` so its policies can reference this table.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A signed-in user can only ever see their own row here — enough for the
-- app to check "am I an admin?" without exposing the list to anyone else.
create policy "Users can check their own admin status"
  on public.admins for select
  using (auth.uid() = user_id);

-- ---------- global chat ----------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  content text not null check (char_length(content) <= 500),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages(created_at);

alter table public.messages enable row level security;

-- The chat is visible to every visitor, signed in or not.
create policy "Anyone can view messages"
  on public.messages for select
  using (true);

-- Only signed-in users can post, and only ever as themselves. The
-- is_admin flag can only be set true if the sender is actually listed in
-- `admins` — checked here, in the database, so it can't be spoofed by
-- calling the API directly with is_admin: true.
create policy "Signed-in users can send messages"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and (
      is_admin = false
      or exists (select 1 from public.admins where admins.user_id = auth.uid())
    )
  );

-- Admins can delete any chat message — individually, or all at once.
create policy "Admins can delete messages"
  on public.messages for delete
  using (
    exists (select 1 from public.admins where admins.user_id = auth.uid())
  );

-- No update policy on purpose — messages can't be edited after sending.

-- Enable realtime so new messages appear live without anyone refreshing.
alter publication supabase_realtime add table public.messages;

-- ---------- make yourself an admin ----------
-- Find your user id: Authentication -> Users in the dashboard, or run
-- `select id, email from auth.users;` — then run this, substituting it in:
--
--   insert into public.admins (user_id) values ('paste-your-user-id-here');
