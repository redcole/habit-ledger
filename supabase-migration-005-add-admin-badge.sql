-- Run this once to add an "ADMIN" badge on messages sent by admin accounts.
-- The database itself verifies the sender is actually an admin before
-- allowing is_admin to be set true, so it can't be spoofed by calling the
-- API directly and passing is_admin: true.

alter table public.messages add column if not exists is_admin boolean not null default false;

drop policy if exists "Signed-in users can send messages" on public.messages;

create policy "Signed-in users can send messages"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and (
      is_admin = false
      or exists (select 1 from public.admins where admins.user_id = auth.uid())
    )
  );
