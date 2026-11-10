-- ===========================================================
-- SpinShot 360 — Cloudinary retention (free videos are temporary)
-- ===========================================================
-- Cloudinary storage was growing without bound: nothing ever deleted a
-- video from it (not user deletes, not account deletion, not free users'
-- old videos). This migration adds:
--
-- 1. videos.expired_at — set when the retention job removes the asset;
--    the row stays (history) but its URLs are nulled.
-- 2. cloudinary_deletion_queue — every DELETE on public.videos (manual
--    delete, account-deletion cascade, anything) enqueues the Cloudinary
--    public_id parsed from the URL. The expire-free-videos edge function
--    drains it, because the Cloudinary API secret never touches the DB
--    or the client.
-- 3. A daily cron for expire-free-videos. It is scheduled with
--    dry_run=true on purpose: review the logs, then flip it (see bottom).
--
-- Eligibility for expiry is derived server-side at run time (owner has
-- no active subscription AND the event is not a purchased event pass AND
-- no anti-refund hold in flight), never from a client-written column.

alter table public.videos
  add column if not exists expired_at timestamptz;

-- Not user-writable: otherwise an owner could clear it on their own row
-- (RLS authenticated_update_own_videos allows arbitrary columns).
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
    new.expired_at             := old.expired_at;
  end if;
  return new;
end;
$$;

-- "…/video/upload/<transformations>/f_mp4/<public_id>.mp4" → "<public_id>"
create or replace function public.cloudinary_public_id_from_url(url text)
returns text
language sql
immutable
as $$
  select substring(url from '/f_mp4/([^?]+)\.mp4');
$$;

create table if not exists public.cloudinary_deletion_queue (
  id         bigserial primary key,
  public_id  text        not null,
  attempts   integer     not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

-- Server-only table: RLS on, no policies → only service_role can touch it.
alter table public.cloudinary_deletion_queue enable row level security;

create or replace function public.enqueue_cloudinary_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid text;
begin
  -- Only user-owned renders; never anything outside spinshot/<uuid>/.
  pid := public.cloudinary_public_id_from_url(old.video_url);
  if pid is not null and pid ~ '^spinshot/[0-9a-fA-F-]{36}/video_[0-9]+_fx$' then
    insert into public.cloudinary_deletion_queue (public_id) values (pid);
  end if;
  return old;
end;
$$;

drop trigger if exists enqueue_cloudinary_deletion_trigger on public.videos;
create trigger enqueue_cloudinary_deletion_trigger
  after delete on public.videos
  for each row execute function public.enqueue_cloudinary_deletion();

-- Helps the retention scan.
create index if not exists videos_retention_scan_idx
  on public.videos (created_at)
  where expired_at is null and video_url is not null;

-- ── Daily cron (dry run first) ─────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('expire-free-videos-daily')
where exists (select 1 from cron.job where jobname = 'expire-free-videos-daily');

select cron.schedule(
  'expire-free-videos-daily',
  '15 4 * * *',
  $$
  select net.http_post(
    url := 'https://nlpzdxxbifpjwpywwiof.supabase.co/functions/v1/expire-free-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'internal_function_secret'
      )
    ),
    body := '{"dry_run": true}'::jsonb
  );
  $$
);

-- TO GO LIVE after reviewing the dry-run logs, run once in the SQL editor:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'expire-free-videos-daily'),
--     command := replace(
--       (select command from cron.job where jobname = 'expire-free-videos-daily'),
--       '"dry_run": true', '"dry_run": false')
--   );
