-- ===========================================================
-- SpinShot 360 — Per-event entitlement (one-off event pass + free first event)
-- ===========================================================
-- Replaces the account-wide 30-day "reverse trial" free window with a
-- narrower, more defensible model: the FIRST event a new account creates
-- is free (unlimited/no watermark/1080p), and every event after that
-- needs either an active subscription OR a one-off "event pass" purchase
-- scoped to that specific event's real-world date.
--
-- event_date anchors the unlock window to the event's actual date (not
-- the purchase date, and not a rolling account-wide timer), which closes
-- two abuse paths: buying the pass before the event happens (a pure
-- purchase-time timer would expire before the event even starts if
-- bought early), and reusing the same event_id indefinitely for
-- unrelated real-world events (blocked by making event_date immutable).
--
-- unlock_source/unlocked_at/event_date are never writable by the client
-- directly — same "server resolves entitlement, client never grants it
-- itself" discipline as protect_subscription_columns() in
-- 20260628032514_security_hardening.sql.
-- ===========================================================

alter table public.events
  add column if not exists event_date    date,
  add column if not exists unlock_source text,
  add column if not exists unlocked_at   timestamptz;

alter table public.events
  add constraint events_unlock_source_check
  check (unlock_source is null or unlock_source in ('purchase', 'free_first_event'));

-- ── 1. event_date is immutable once set, unlock_source/unlocked_at are
--      service_role-only (mirrors protect_subscription_columns) ───────────

create or replace function public.protect_event_entitlement_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- event_date can only be set once, at creation — never changed after,
  -- by anyone (including service_role), so a purchased/free-unlocked
  -- event can't be silently retargeted at a different real-world date.
  new.event_date := old.event_date;

  if coalesce(auth.role(), '') <> 'service_role' then
    new.unlock_source := old.unlock_source;
    new.unlocked_at    := old.unlocked_at;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_event_entitlement_columns_trigger on public.events;
create trigger protect_event_entitlement_columns_trigger
  before update on public.events
  for each row
  execute function public.protect_event_entitlement_columns();

-- ── 2. First event ever for an account is auto-unlocked as
--      'free_first_event' — client-supplied unlock_source/unlocked_at on
--      INSERT is always ignored, this is the only path that can set them
--      besides a service-role UPDATE (the paid-unlock flow). ─────────────

create or replace function public.grant_free_first_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.unlock_source := null;
  new.unlocked_at    := null;

  if not exists (select 1 from public.events where user_id = new.user_id) then
    new.unlock_source := 'free_first_event';
    new.unlocked_at    := now();
  end if;

  return new;
end;
$$;

drop trigger if exists grant_free_first_event_trigger on public.events;
create trigger grant_free_first_event_trigger
  before insert on public.events
  for each row
  execute function public.grant_free_first_event();
