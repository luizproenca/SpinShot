-- ===========================================================
-- SpinShot 360 — Funnel analytics (paywall funnel visibility)
-- ===========================================================
-- Minimal event log so we can answer "how many people saw the paywall
-- vs attempted a purchase vs completed one" — there was previously no
-- product analytics of any kind in this app. Queried manually via the
-- SQL Editor for now (no dashboard yet).

create table if not exists public.funnel_events (
  id          uuid        not null default gen_random_uuid(),
  user_id     uuid        references public.user_profiles(id) on delete cascade,
  event_type  text        not null,
  trigger     text,
  metadata    jsonb,
  created_at  timestamptz          default now(),

  constraint funnel_events_pkey primary key (id)
);

comment on table public.funnel_events is 'Lightweight product funnel log (paywall_viewed, purchase_attempted, purchase_completed, purchase_failed, etc.)';

create index if not exists funnel_events_user_id_idx on public.funnel_events(user_id);
create index if not exists funnel_events_event_type_idx on public.funnel_events(event_type);
create index if not exists funnel_events_created_at_idx on public.funnel_events(created_at);

alter table public.funnel_events enable row level security;

create policy "authenticated_insert_own_funnel_events"
  on public.funnel_events for insert to authenticated
  with check (user_id = auth.uid());
