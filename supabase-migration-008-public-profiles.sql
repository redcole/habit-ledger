-- Run this once to support public profile pages. Each habit gets an
-- is_public flag (public by default, opt out per habit), and each account
-- can claim a username to get a shareable profile at /u/<username>.

alter table public.habits
  add column if not exists is_public boolean not null default true;

alter table public.profiles
  add column if not exists username text unique;

-- Keep usernames sane: lowercase letters, numbers, hyphens, 3-24 chars.
-- The app also validates this client-side before saving, but the
-- constraint is enforced here too so it can't be bypassed by calling the
-- API directly.
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9-]{3,24}$');

-- A profile only becomes publicly visible once its owner sets a username
-- — that's the actual "opt in to being discoverable" moment. Habits are
-- public-by-default underneath that, but nobody can reach them without a
-- username to look up in the first place.
create policy "Public profiles are viewable by anyone"
  on public.profiles for select
  using (username is not null);

-- Anyone (including signed-out visitors) can see a habit that's flagged
-- public. Combined with the policy above, this is what powers /u/<username>
-- profile pages.
create policy "Public habits are viewable by anyone"
  on public.habits for select
  using (is_public = true);
