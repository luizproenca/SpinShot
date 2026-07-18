-- ===========================================================
-- SpinShot 360 — Push notification tokens
-- ===========================================================
-- Stores one Expo push token per (user, device). A user can be logged in
-- on more than one device, so this is not a single column on user_profiles.
-- ===========================================================

create table if not exists public.push_tokens (
  id          uuid        not null default gen_random_uuid(),
  user_id     uuid        not null references public.user_profiles(id) on delete cascade,
  token       text        not null,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint push_tokens_pkey primary key (id),
  constraint push_tokens_token_unique unique (token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
  on public.push_tokens for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own"
  on public.push_tokens for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own"
  on public.push_tokens for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own"
  on public.push_tokens for delete to authenticated
  using (auth.uid() = user_id);
