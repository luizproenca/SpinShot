-- ===========================================================
-- SpinShot 360 — Server-confirmed clean-video reveal (item 6)
-- ===========================================================
-- The anti-refund hold on the no-watermark render used to be a pure
-- client-side clock check (Date.now() > cleanAvailableAt) and only ever
-- applied to one-off event-pass purchases. Two gaps found during fraud
-- review:
--
-- 1. Subscriptions had NO hold at all — instant clean access, any number
--    of events, the easiest path for the "buy today, use today, refund
--    tomorrow, repeat" cycle.
-- 2. Even for purchases, "48h has passed" was never actually re-checked
--    against whether a refund happened in that window — just elapsed
--    time, decided entirely client-side.
--
-- This adds the column the new reconcile-clean-video function (+ its
-- cron schedule) uses to flip the reveal only after re-confirming, at
-- expiry time, that no refund landed in the meantime — and protects it
-- the same way other entitlement columns are, since RLS's
-- authenticated_update_own_videos policy otherwise lets any owner set
-- arbitrary columns on their own row.

alter table public.videos
  add column if not exists hold_reason text check (hold_reason in ('purchase', 'subscription')),
  add column if not exists clean_confirmed_at timestamptz;

-- Videos already holding a watermarked variant predate hold_reason —
-- backfill so the reconciliation job can find them. clean_confirmed_at
-- stays null so they go through real confirmation instead of being
-- grandfathered in as already-clean (a brief re-hold until the next
-- cron tick, then resolved automatically).
update public.videos
set hold_reason = 'purchase'
where video_url_watermarked is not null
  and clean_available_at is not null
  and hold_reason is null;

create or replace function public.protect_video_hold_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.hold_reason            := old.hold_reason;
    new.clean_confirmed_at     := old.clean_confirmed_at;
    new.clean_available_at     := old.clean_available_at;
    new.video_url_watermarked  := old.video_url_watermarked;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_video_hold_columns_trigger on public.videos;
create trigger protect_video_hold_columns_trigger
  before update on public.videos
  for each row execute function public.protect_video_hold_columns();
