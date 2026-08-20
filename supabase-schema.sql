-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor).
-- It creates the habits table and locks it down so each account can only
-- ever see or modify its own rows.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  completions jsonb not null default '{}'::jsonb,
  position integer,
  created_at timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits(user_id);

alter table public.habits enable row level security;

create policy "Users can view their own habits"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on public.habits for update
  using (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on public.habits for delete
  using (auth.uid() = user_id);

-- ---------- global chat ----------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages(created_at);

alter table public.messages enable row level security;

-- The chat is visible to every visitor, signed in or not.
create policy "Anyone can view messages"
  on public.messages for select
  using (true);

-- Only signed-in users can post, and only ever as themselves.
create policy "Signed-in users can send messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

-- No update/delete policies on purpose — messages are permanent once sent.

-- Enable realtime so new messages appear live without anyone refreshing.
alter publication supabase_realtime add table public.messages;
