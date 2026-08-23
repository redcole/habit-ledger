-- Run this once to add a "real name" to each account, so the app can show
-- e.g. "Signed in as Jordan Reyes" instead of the account's email address.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Auto-create a profile row the moment someone signs up, seeded from the
-- full name they typed into the sign-up form (the client sends it as
-- auth metadata on signUp — see src/Auth.jsx). This runs with elevated
-- privileges so it works even when email confirmation delays the first
-- real session, which is when RLS would otherwise block the insert.
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

-- Backfill: existing accounts created before this migration won't have a
-- profiles row yet. This gives them an empty one so the app can just
-- always expect a row to be there once signed in (name shows as blank /
-- falls back to email in the UI until they set it).
insert into public.profiles (user_id, full_name)
select id, raw_user_meta_data->>'full_name' from auth.users
on conflict (user_id) do nothing;
