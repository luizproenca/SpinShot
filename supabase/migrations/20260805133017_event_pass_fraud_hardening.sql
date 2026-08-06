-- ===========================================================
-- SpinShot 360 — Event pass fraud-hardening (round 2)
-- ===========================================================
-- Closes gaps found while stress-testing the entitlement system:
--
-- 1. "Free first event" was granted based on `not exists (select from
--    events where user_id = ...)` — deleting all your events reset that
--    check, letting an account claim the free grant more than once.
--    Fix: track eligibility as a permanent fact on user_profiles instead
--    of deriving it from events, which is deletable.
--
-- 2. unlock_event compared *counts* (events unlocked vs. RC purchases) to
--    stop one receipt unlocking multiple events. Once refunds are
--    handled (separate follow-up), a refund lowers the event-side count
--    but not the RC-side count — the next comparison would find a "free
--    slot" and hand out an unpaid unlock. Fix: track the *specific* RC
--    transaction id used per event, not just a count.
--
-- 3. Foundation for anti-abuse escalation: trusted_purchaser_at (skips
--    the anti-refund hold once an account has proven itself once) and
--    refund_count (restricts one-off purchases after repeat refunds,
--    subscription stays available). Both populated by follow-up work on
--    the refund webhook — this migration only adds the columns.
-- ===========================================================

-- ── 1. Persist "already got the free first event" outside of events ────────

alter table public.user_profiles
  add column if not exists free_event_granted_at timestamptz,
  add column if not exists trusted_purchaser_at   timestamptz,
  add column if not exists refund_count           integer not null default 0;

-- Backfill: accounts that already have a free_first_event-unlocked event
-- must be marked as already-granted, or this migration itself would
-- reopen the exact brecha it's meant to close (blank column = eligible
-- again on their next event).
update public.user_profiles p
set free_event_granted_at = e.unlocked_at
from public.events e
where e.user_id = p.id
  and e.unlock_source = 'free_first_event'
  and p.free_event_granted_at is null;

create or replace function public.grant_free_first_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.unlock_source := null;
  new.unlocked_at    := null;

  if exists (
    select 1 from public.user_profiles
    where id = new.user_id and free_event_granted_at is null
  ) then
    new.unlock_source := 'free_first_event';
    new.unlocked_at    := now();

    update public.user_profiles
    set free_event_granted_at = new.unlocked_at
    where id = new.user_id;
  end if;

  return new;
end;
$$;
-- Trigger itself (grant_free_first_event_trigger, before insert on events)
-- already exists from 20260804142000_event_entitlement.sql and doesn't
-- need to be recreated — replacing the function is enough.

-- ── 2. Track the specific RC transaction used per event, not just a count ──

alter table public.events
  add column if not exists purchase_transaction_id text;

-- Extend the existing entitlement-column guard (20260804142000) to also
-- pin purchase_transaction_id for non-service-role writers. Once set by
-- a service-role unlock, it's never cleared even if unlock_source later
-- gets revoked by a refund — that's what keeps a refunded transaction
-- from ever being matched as "available" again (application-level rule
-- enforced in validate-purchase/rc-webhook, not by this trigger).
create or replace function public.protect_event_entitlement_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.event_date := old.event_date;

  if coalesce(auth.role(), '') <> 'service_role' then
    new.unlock_source           := old.unlock_source;
    new.unlocked_at             := old.unlocked_at;
    new.purchase_transaction_id := old.purchase_transaction_id;
  end if;

  return new;
end;
$$;

-- ── 3. Protect the new user_profiles columns the same way subscription
--      columns already are (20260628032514_security_hardening.sql) ────────

create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.subscription_plan       := old.subscription_plan;
    new.subscription_status     := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.trial_start_at          := old.trial_start_at;
    new.purchase_token          := old.purchase_token;
    new.store_platform          := old.store_platform;
    new.free_event_granted_at   := old.free_event_granted_at;
    new.trusted_purchaser_at    := old.trusted_purchaser_at;
    new.refund_count            := old.refund_count;
  end if;
  return new;
end;
$$;
-- Trigger itself (protect_subscription_columns_trigger, before update on
-- user_profiles) already exists and doesn't need to be recreated.
