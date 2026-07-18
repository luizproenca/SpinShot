-- ===========================================================
-- SpinShot 360 — Security hardening
-- ===========================================================
-- Fixes two issues found in a security review:
--
-- 1. public.user_profiles RLS allowed an authenticated user to UPDATE
--    *any* column on their own row, including subscription_plan,
--    subscription_status, subscription_expires_at, trial_start_at,
--    purchase_token and store_platform — i.e. any user could grant
--    themselves a permanent "pro" subscription with a single client-side
--    REST call, with no edge function or RevenueCat involved at all.
--    Fix: a BEFORE UPDATE trigger pins those columns back to their old
--    value unless the write comes from the service_role (used only by
--    our trusted edge functions: validate-purchase, rc-webhook).
--
-- 2. public.recording_state (used by the live "operator" kiosk screen,
--    app/operator/[eventId].tsx) is not in any versioned migration, so
--    its RLS could not be audited from the repo. The kiosk screen is
--    designed to be viewed without login (whoever has the event's QR
--    code/link can watch — same trust model as a meeting link; event
--    ids are unguessable uuids), so SELECT stays open. But WRITES
--    (upserted by app/recording.tsx and app/processing.tsx while running
--    the booth) must be restricted to the event's own owner — otherwise
--    any authenticated user could overwrite another user's live event
--    state with an arbitrary video_url, e.g. to redirect real guests
--    scanning the kiosk's QR code to a phishing link.
-- ===========================================================

-- ── 1. Protect subscription columns on user_profiles ───────────────────────

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
  end if;
  return new;
end;
$$;

drop trigger if exists protect_subscription_columns_trigger on public.user_profiles;
create trigger protect_subscription_columns_trigger
  before update on public.user_profiles
  for each row
  execute function public.protect_subscription_columns();

-- ── 2. recording_state table + RLS ──────────────────────────────────────────

create table if not exists public.recording_state (
  event_id          uuid        not null references public.events(id) on delete cascade,
  event_name        text,
  event_color       text,
  status            text        not null default 'idle',
  countdown         integer     not null default 0,
  remaining_seconds integer     not null default 0,
  total_seconds     integer     not null default 0,
  video_url         text,
  thumbnail_url     text,
  qr_ready          boolean     not null default false,
  updated_at        timestamptz          default now(),
  constraint recording_state_pkey primary key (event_id)
);

alter table public.recording_state enable row level security;

-- Kiosk screen reads without auth — possession of the event's uuid is the
-- access control (same model as a shared meeting link).
drop policy if exists "recording_state_select_all" on public.recording_state;
create policy "recording_state_select_all"
  on public.recording_state for select
  using (true);

-- event_id's exact column type varies depending on how the table was first
-- created outside of versioned migrations — cast both sides to text so this
-- works whether it's uuid or text.
drop policy if exists "recording_state_insert_owner" on public.recording_state;
create policy "recording_state_insert_owner"
  on public.recording_state for insert to authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id::text = recording_state.event_id::text and e.user_id = auth.uid()
    )
  );

drop policy if exists "recording_state_update_owner" on public.recording_state;
create policy "recording_state_update_owner"
  on public.recording_state for update to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id::text = recording_state.event_id::text and e.user_id = auth.uid()
    )
  );

-- Make sure the realtime publication includes this table so the operator
-- screen's postgres_changes subscription keeps working (no-op if already added).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recording_state'
  ) then
    alter publication supabase_realtime add table public.recording_state;
  end if;
end $$;
