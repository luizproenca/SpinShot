-- ===========================================================
-- SpinShot 360 — 30-day reverse-trial free window
-- ===========================================================
-- New accounts get full Pro-equivalent access for FREE_WINDOW_DAYS (30)
-- days after signup, no payment required — replaces the old IAP free
-- trial. Needs user_profiles.created_at so the server (process-video) can
-- compute this independently of the client.
-- ===========================================================

alter table public.user_profiles
  add column if not exists created_at timestamptz not null default now();

-- Backfill existing accounts from their real auth.users signup date.
update public.user_profiles p
set created_at = u.created_at
from auth.users u
where p.id = u.id
  and p.created_at is distinct from u.created_at;

-- Make new signups carry the real auth.users timestamp instead of the
-- column default (which would be a few milliseconds later).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, username, created_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.created_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
