-- Run this once to make the chat show each sender's real name (if they've
-- set one) instead of always deriving a name from their email address.

alter table public.messages add column if not exists user_display_name text;

-- No RLS changes needed: the existing insert policy still applies as-is,
-- and this column is simply along for the ride on every insert from here
-- on. Older messages sent before this migration will have a null value
-- here — the app falls back to the email-derived name for those, same as
-- it always has.
