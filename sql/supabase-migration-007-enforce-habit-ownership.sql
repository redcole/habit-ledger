-- Run this in the Supabase SQL Editor for existing projects.
-- It turns on database-level isolation even if an earlier setup left the
-- habits table with permissive or missing policies.

alter table public.habits enable row level security;

drop policy if exists "Users can view their own habits" on public.habits;
drop policy if exists "Users can insert their own habits" on public.habits;
drop policy if exists "Users can update their own habits" on public.habits;
drop policy if exists "Users can delete their own habits" on public.habits;

create policy "Users can view their own habits"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on public.habits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on public.habits for delete
  using (auth.uid() = user_id);
