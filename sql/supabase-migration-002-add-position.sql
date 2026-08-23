-- Run this once in your Supabase SQL Editor if your `habits` table was
-- created before drag-to-reorder was added. New installs already get this
-- column from supabase-schema.sql, so this file is only for existing ones.
--
-- No backfill needed here — the app assigns sequential positions to any
-- rows with a null position the next time it loads your habits.

alter table public.habits add column if not exists position integer;
