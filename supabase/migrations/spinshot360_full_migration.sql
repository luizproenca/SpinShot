-- =============================================================
-- SpinShot 360 – Full Database Migration Script
-- Target: Supabase (self-managed or Supabase Cloud)
-- Generated: 2026-04-22
-- =============================================================
-- Run this entire script in the Supabase SQL Editor (Dashboard)
-- or via: psql $DATABASE_URL -f spinshot360_full_migration.sql
-- =============================================================


-- ===========================================================
-- 0. EXTENSIONS
-- ===========================================================
create extension if not exists "uuid-ossp";


-- ===========================================================
-- 1. TABLES
-- ===========================================================

-- -------------------------------------------------------
-- 1.1 user_profiles
-- Synced automatically from auth.users via trigger
-- -------------------------------------------------------
create table if not exists public.user_profiles (
  id                      uuid          not null references auth.users(id) on delete cascade,
  username                text,
  email                   text          not null,
  subscription_plan       text          not null default 'free',
  subscription_status     text          not null default 'inactive',
  trial_start_at          timestamptz,
  subscription_expires_at timestamptz,
  purchase_token          text,
  store_platform          text,

  constraint user_profiles_pkey primary key (id)
);

comment on table public.user_profiles is 'Extended user profile synced from auth.users';

-- -------------------------------------------------------
-- 1.2 video_frames
-- Default frames (is_default=true) or user-uploaded frames
-- -------------------------------------------------------
create table if not exists public.video_frames (
  id                   uuid        not null default gen_random_uuid(),
  user_id              uuid        references public.user_profiles(id) on delete cascade,
  name                 text        not null,
  cloudinary_public_id text        not null,
  thumbnail_url        text,
  is_premium           boolean     not null default false,
  is_default           boolean     not null default false,
  category             text,
  created_at           timestamptz          default now(),

  constraint video_frames_pkey primary key (id)
);

comment on table public.video_frames is 'Overlay frames for video branding (default + user-uploaded)';

-- -------------------------------------------------------
-- 1.3 music_tracks
-- Pre-loaded tracks served to all users
-- -------------------------------------------------------
create table if not exists public.music_tracks (
  id                   text        not null,
  title                text        not null,
  artist               text        not null default 'SpinShot Beats',
  category             text        not null,
  emoji                text        not null default '🎵',
  cloudinary_public_id text        not null,
  preview_url          text,
  duration             integer     not null default 120,
  bpm                  integer     not null default 120,
  is_premium           boolean     not null default false,
  created_at           timestamptz          default now(),

  constraint music_tracks_pkey primary key (id)
);

comment on table public.music_tracks is 'Background music library for video recording';

-- -------------------------------------------------------
-- 1.4 events
-- Events created by each user (with branding)
-- -------------------------------------------------------
create table if not exists public.events (
  id                   uuid        not null default gen_random_uuid(),
  user_id              uuid        not null references public.user_profiles(id) on delete cascade,
  name                 text        not null,
  color                text        not null default '#8B5CF6',
  logo_url             text,
  music                text,
  video_count          integer     not null default 0,
  created_at           timestamptz          default now(),
  frame_id             uuid        references public.video_frames(id) on delete set null,
  frame_cloudinary_id  text,

  constraint events_pkey primary key (id)
);

comment on table public.events is 'User events with branding (logo, color, music, frame)';

-- -------------------------------------------------------
-- 1.5 videos
-- Videos produced and linked to events
-- -------------------------------------------------------
create table if not exists public.videos (
  id             uuid        not null default gen_random_uuid(),
  user_id        uuid        not null references public.user_profiles(id) on delete cascade,
  event_id       uuid        references public.events(id) on delete set null,
  event_name     text        not null,
  event_color    text                 default '#8B5CF6',
  video_url      text,
  thumbnail_uri  text,
  effect         text                 default 'normal',
  duration       integer              default 15,
  share_url      text,
  share_code     text,
  downloads      integer     not null default 0,
  created_at     timestamptz          default now(),

  constraint videos_pkey primary key (id)
);

comment on table public.videos is 'Produced videos linked to user events';

-- -------------------------------------------------------
-- 1.6 subscription_events
-- Audit log of subscription lifecycle events
-- -------------------------------------------------------
create table if not exists public.subscription_events (
  id             uuid        not null default gen_random_uuid(),
  user_id        uuid        not null references public.user_profiles(id) on delete cascade,
  event_type     text        not null,
  plan           text,
  platform       text,
  purchase_token text,
  created_at     timestamptz          default now(),

  constraint subscription_events_pkey primary key (id)
);

comment on table public.subscription_events is 'Subscription lifecycle audit log (purchase, renewal, cancellation)';


-- ===========================================================
-- 2. FUNCTIONS & TRIGGERS
-- ===========================================================

-- -------------------------------------------------------
-- 2.1 handle_new_user
-- Creates user_profiles row when a new auth user signs up
-- -------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: fires on every new auth user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -------------------------------------------------------
-- 2.2 sync_user_metadata
-- Keeps user_profiles.email in sync when auth user is updated
-- -------------------------------------------------------
create or replace function public.sync_user_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set
    email    = new.email,
    username = coalesce(
                 new.raw_user_meta_data->>'username',
                 new.raw_user_meta_data->>'name',
                 username
               )
  where id = new.id;
  return new;
end;
$$;

-- Trigger: fires on every auth user update
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.sync_user_metadata();


-- -------------------------------------------------------
-- 2.3 delete_own_account
-- Allows authenticated users to self-delete (bypasses admin API)
-- -------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Cascades to user_profiles (and all FK children) automatically
  delete from auth.users where id = _uid;
end;
$$;

-- Grant only to authenticated users, deny anon
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;


-- ===========================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ===========================================================

-- -------------------------------------------------------
-- 3.1 user_profiles
-- -------------------------------------------------------
alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update to authenticated
  using (auth.uid() = id);

create policy "Users can delete own profile"
  on public.user_profiles for delete to authenticated
  using (auth.uid() = id);

-- -------------------------------------------------------
-- 3.2 video_frames
-- -------------------------------------------------------
alter table public.video_frames enable row level security;

-- Any authenticated user can read default frames OR their own frames
create policy "authenticated_select_frames"
  on public.video_frames for select to authenticated
  using (is_default = true or user_id = auth.uid());

create policy "authenticated_insert_own_frames"
  on public.video_frames for insert to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_frames"
  on public.video_frames for update to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_frames"
  on public.video_frames for delete to authenticated
  using (user_id = auth.uid());

-- -------------------------------------------------------
-- 3.3 music_tracks (public read)
-- -------------------------------------------------------
alter table public.music_tracks enable row level security;

create policy "all_select_music_tracks"
  on public.music_tracks for select to anon, authenticated
  using (true);

-- -------------------------------------------------------
-- 3.4 events
-- -------------------------------------------------------
alter table public.events enable row level security;

create policy "authenticated_select_own_events"
  on public.events for select to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_events"
  on public.events for insert to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_events"
  on public.events for update to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_events"
  on public.events for delete to authenticated
  using (user_id = auth.uid());

-- -------------------------------------------------------
-- 3.5 videos
-- -------------------------------------------------------
alter table public.videos enable row level security;

create policy "authenticated_select_own_videos"
  on public.videos for select to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_videos"
  on public.videos for insert to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_update_own_videos"
  on public.videos for update to authenticated
  using (user_id = auth.uid());

create policy "authenticated_delete_own_videos"
  on public.videos for delete to authenticated
  using (user_id = auth.uid());

-- -------------------------------------------------------
-- 3.6 subscription_events
-- -------------------------------------------------------
alter table public.subscription_events enable row level security;

create policy "authenticated_select_own_sub_events"
  on public.subscription_events for select to authenticated
  using (user_id = auth.uid());

create policy "authenticated_insert_own_sub_events"
  on public.subscription_events for insert to authenticated
  with check (user_id = auth.uid());


-- ===========================================================
-- 4. STORAGE BUCKETS
-- (Run in SQL Editor — Supabase Storage uses the storage schema)
-- ===========================================================

-- -------------------------------------------------------
-- 4.1 spinshot-videos (500 MB limit, video formats)
-- -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spinshot-videos',
  'spinshot-videos',
  true,
  524288000,  -- 500 MB
  array['video/mp4','video/mov','video/quicktime','video/3gpp','video/mpeg','video/webm']
)
on conflict (id) do nothing;

-- -------------------------------------------------------
-- 4.2 spinshot-logos (5 MB limit, image formats)
-- -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spinshot-logos',
  'spinshot-logos',
  true,
  5242880,   -- 5 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- -------------------------------------------------------
-- 4.3 spinshot-frames (10 MB limit, PNG only)
-- -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spinshot-frames',
  'spinshot-frames',
  true,
  10485760,  -- 10 MB
  array['image/png']
)
on conflict (id) do nothing;


-- ===========================================================
-- 5. STORAGE RLS POLICIES
-- ===========================================================

-- -------------------------------------------------------
-- 5.1 spinshot-videos
-- -------------------------------------------------------
create policy "public_read_videos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'spinshot-videos');

create policy "authenticated_upload_own_videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'spinshot-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated_update_own_videos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'spinshot-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated_delete_own_videos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'spinshot-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -------------------------------------------------------
-- 5.2 spinshot-logos
-- -------------------------------------------------------
create policy "public_read_logos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'spinshot-logos');

create policy "authenticated_upload_own_logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'spinshot-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated_update_own_logos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'spinshot-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated_delete_own_logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'spinshot-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -------------------------------------------------------
-- 5.3 spinshot-frames
-- -------------------------------------------------------
create policy "public_read_frames"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'spinshot-frames');

create policy "authenticated_upload_own_frames"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'spinshot-frames'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated_update_own_frames"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'spinshot-frames'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated_delete_own_frames"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'spinshot-frames'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ===========================================================
-- 6. INDEXES (performance)
-- ===========================================================
create index if not exists idx_events_user_id         on public.events(user_id);
create index if not exists idx_videos_user_id          on public.videos(user_id);
create index if not exists idx_videos_event_id         on public.videos(event_id);
create index if not exists idx_video_frames_user_id    on public.video_frames(user_id);
create index if not exists idx_video_frames_is_default on public.video_frames(is_default);
create index if not exists idx_sub_events_user_id      on public.subscription_events(user_id);
create index if not exists idx_music_tracks_category   on public.music_tracks(category);


-- ===========================================================
-- END OF MIGRATION
-- ===========================================================
-- Next steps after running this script:
--
-- 1. Deploy Edge Functions:
--    supabase functions deploy delete-account
--    supabase functions deploy process-video
--    supabase functions deploy rc-webhook
--    supabase functions deploy upload-frame
--    supabase functions deploy upload-music
--    supabase functions deploy validate-purchase
--
-- 2. Set secrets via Supabase CLI:
--    supabase secrets set CLOUDINARY_CLOUD_NAME=djfbrkwkz
--    supabase secrets set CLOUDINARY_API_KEY=181772372845664
--    supabase secrets set CLOUDINARY_API_SECRET=-XPgqqpEwvd0nJlKtwUuWxumiCA
--    supabase secrets set REVENUECAT_API_KEY=sk_BzJGWaJdjtIbfEWpUCfvEhYydUxbF
--    supabase secrets set EXPO_PUBLIC_RC_IOS_KEY=appl_ZfnzCLOiutECEtkyJzxiSzqMjGF
--    supabase secrets set EXPO_PUBLIC_RC_ANDROID_KEY=goog_yqVIoIHBoMuMfMnzlyGZCIyYcIN
--
-- 3. Update .env in the app:
--    EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
--    EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
--
-- 4. In Supabase Dashboard → Authentication → Settings:
--    - Set minimum password length: 6
--    - Set email OTP length: 4
--    - Enable Google OAuth provider (if desired)
--    - Set Site URL and Redirect URLs for deep linking
-- =============================================================
