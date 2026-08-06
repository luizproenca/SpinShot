-- ===========================================================
-- SpinShot 360 — Profile sync fixes for social login (Apple + Google)
-- ===========================================================
-- handle_new_user() (current version in 20260628125402_free_window.sql)
-- and sync_user_metadata() (spinshot360_full_migration.sql) were written
-- before social login existed and have two real gaps for it:
--
-- 1. Neither reads `full_name` from raw_user_meta_data. That's exactly the
--    key Supabase populates from a Google ID token (Apple uses `name` on
--    first authorization, already covered) — a Google signup would fall
--    straight through to the email-prefix fallback.
-- 2. handle_new_user() does `split_part(new.email, '@', 1)` with no null
--    guard, and user_profiles.email is NOT NULL. If a provider ever
--    returns no email at all, split_part returns NULL and the INSERT
--    violates the NOT NULL constraint — aborting the entire auth.users
--    insert, i.e. signup fails outright instead of degrading gracefully.
--
-- Both fixed here without changing behavior for existing email/password
-- signups: register() already sends options.data: { username, name }, so
-- `username` stays the first branch checked in both functions.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := coalesce(new.email, '');
  v_username text;
begin
  v_username := nullif(trim(coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'preferred_username',
    ''
  )), '');

  if v_username is null and v_email <> '' then
    v_username := split_part(v_email, '@', 1);
  end if;

  insert into public.user_profiles (id, email, username, created_at)
  values (new.id, v_email, v_username, new.created_at)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_user_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set
    email    = coalesce(new.email, email),
    username = coalesce(
                 nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), ''),
                 nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), ''),
                 nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
                 username
               )
  where id = new.id;
  return new;
end;
$$;

-- Triggers themselves (on_auth_user_created, on_auth_user_updated) already
-- exist and don't need to be recreated — replacing the functions is enough.
-- No RLS impact: both are security definer and neither touches
-- subscription/entitlement columns, so protect_subscription_columns_trigger
-- is unaffected.
