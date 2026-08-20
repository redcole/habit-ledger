-- Run this once in your Supabase SQL Editor to add the global chat feature.
-- (Already included in supabase-schema.sql for brand-new installs — this
-- file is for projects that ran that schema before chat existed.)

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
