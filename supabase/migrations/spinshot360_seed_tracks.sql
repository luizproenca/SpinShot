-- =============================================================
-- SpinShot 360 – Seed Data (Initial Content)
-- Target: Supabase (self-managed or Supabase Cloud)
-- Run AFTER: spinshot360_full_migration.sql
-- =============================================================
-- This script inserts:
--   1. Default video frames (is_default = true, visible to all users)
--   2. Music tracks (pre-loaded library for all categories)
-- =============================================================
-- IMPORTANT: The cloudinary_public_id values below must match
-- the actual public IDs of assets you upload to YOUR Cloudinary
-- account. Replace the placeholder values with your real IDs
-- before running this script.
-- =============================================================


-- ===========================================================
-- 1. DEFAULT VIDEO FRAMES
-- ===========================================================
-- These frames are shared globally (is_default = true, user_id = null).
-- They appear in the frames library for every user.
-- thumbnail_url is built at runtime by the app using:
--   https://res.cloudinary.com/<cloud>/image/upload/w_400,h_711,c_fill/<cloudinary_public_id>.png
-- So thumbnail_url can be left null here — the app builds it dynamically.
-- ===========================================================

insert into public.video_frames
  (id, user_id, name, cloudinary_public_id, thumbnail_url, is_premium, is_default, category)
values

  -- ── FREE FRAMES ────────────────────────────────────────────

  (
    gen_random_uuid(),
    null,
    'Festa Clássica',
    'spinshot/frames/frame_party_001',   -- ← Replace with your Cloudinary public_id
    null,
    false,
    true,
    'party'
  ),
  (
    gen_random_uuid(),
    null,
    'Neon Vibes',
    'spinshot/frames/frame_party_002',   -- ← Replace with your Cloudinary public_id
    null,
    false,
    true,
    'party'
  ),
  (
    gen_random_uuid(),
    null,
    'Casamento Dourado',
    'spinshot/frames/frame_wedding_001', -- ← Replace with your Cloudinary public_id
    null,
    false,
    true,
    'wedding'
  ),
  (
    gen_random_uuid(),
    null,
    'Corporativo Clean',
    'spinshot/frames/frame_corporate_001', -- ← Replace with your Cloudinary public_id
    null,
    false,
    true,
    'corporate'
  ),
  (
    gen_random_uuid(),
    null,
    'SpinShot Padrão',
    'spinshot/frames/frame_default_001', -- ← Replace with your Cloudinary public_id
    null,
    false,
    true,
    'general'
  ),

  -- ── PREMIUM FRAMES ─────────────────────────────────────────

  (
    gen_random_uuid(),
    null,
    'Luxury Gold',
    'spinshot/frames/frame_luxury_001',  -- ← Replace with your Cloudinary public_id
    null,
    true,
    true,
    'premium'
  ),
  (
    gen_random_uuid(),
    null,
    'Galaxy Dark',
    'spinshot/frames/frame_galaxy_001',  -- ← Replace with your Cloudinary public_id
    null,
    true,
    true,
    'premium'
  ),
  (
    gen_random_uuid(),
    null,
    'Holográfico',
    'spinshot/frames/frame_holo_001',    -- ← Replace with your Cloudinary public_id
    null,
    true,
    true,
    'premium'
  ),
  (
    gen_random_uuid(),
    null,
    'Casamento Premium',
    'spinshot/frames/frame_wedding_002', -- ← Replace with your Cloudinary public_id
    null,
    true,
    true,
    'wedding'
  ),
  (
    gen_random_uuid(),
    null,
    'Aniversário VIP',
    'spinshot/frames/frame_birthday_001', -- ← Replace with your Cloudinary public_id
    null,
    true,
    true,
    'party'
  )

on conflict do nothing;


-- ===========================================================
-- 2. MUSIC TRACKS
-- ===========================================================
-- IDs MUST match exactly what the app uses in:
--   constants/music.ts  →  PRESET_MUSIC_PRIORITY
--   (party_001, wedding_001, chill_001, corporate_001, etc.)
--
-- The app builds the preview URL at runtime from cloudinary_public_id:
--   https://res.cloudinary.com/<cloud>/video/upload/so_0,eo_30/<cloudinary_public_id>.mp3
-- (so_0,eo_30 caps preview playback at 30s — see buildCloudinaryPreviewUrl()).
-- So preview_url can be null — it is computed by buildCloudinaryPreviewUrl().
--
-- Real tracks (15 total: 3 free + 12 premium), sourced from Mixkit Free
-- Stock Music (https://mixkit.co/free-stock-music/) — free for commercial
-- use, no attribution required (https://mixkit.co/license/). `artist` below
-- credits the real Mixkit composer. Run supabase/functions/upload-music
-- (with real CLOUDINARY_* secrets configured) BEFORE this script, so that
-- cloudinary_public_id actually resolves to uploaded audio.
--
-- This insert is an UPSERT (on conflict do update) so re-running it also
-- repairs any rows previously seeded with placeholder data.
-- ===========================================================

-- corporate_004 existed in the old placeholder seed; the real library only
-- has 3 corporate tracks, so drop it if it was inserted previously.
delete from public.music_tracks where id = 'corporate_004';

insert into public.music_tracks
  (id, title, artist, category, emoji, cloudinary_public_id, preview_url, duration, bpm, is_premium)
values

  -- ── PARTY / ENERGY (Free) ──────────────────────────────────

  (
    'party_001',
    'Cat Walk',
    'Arulo',
    'party',
    '🎉',
    'spinshot/music/party_001',
    null,
    30,
    126,
    false
  ),

  -- ── PARTY / ENERGY (Premium) ───────────────────────────────

  (
    'party_002',
    'Villa Penthouse',
    'Arulo',
    'party',
    '🎉',
    'spinshot/music/party_002',
    null,
    30,
    98,
    true
  ),
  (
    'party_003',
    'Neon Pulse',
    'Michael Ramir C.',
    'party',
    '🎉',
    'spinshot/music/party_003',
    null,
    30,
    150,
    true
  ),
  (
    'party_004',
    'Gimme that Groove!',
    'Michael Ramir C.',
    'party',
    '🎉',
    'spinshot/music/party_004',
    null,
    30,
    112,
    true
  ),

  -- ── WEDDING / EMOTIONAL (Premium) ──────────────────────────

  (
    'wedding_001',
    'Wedding Vows',
    'Francisco Alvear',
    'wedding',
    '💍',
    'spinshot/music/wedding_001',
    null,
    30,
    80,
    true
  ),
  (
    'wedding_002',
    'Romantic Moment',
    'Francisco Alvear',
    'wedding',
    '💍',
    'spinshot/music/wedding_002',
    null,
    30,
    76,
    true
  ),
  (
    'wedding_003',
    'Beautiful Dream',
    'Diego Nava',
    'wedding',
    '💍',
    'spinshot/music/wedding_003',
    null,
    30,
    88,
    true
  ),
  (
    'wedding_004',
    'Latin Lovers',
    'Ahjay Stelino',
    'wedding',
    '💍',
    'spinshot/music/wedding_004',
    null,
    30,
    92,
    true
  ),

  -- ── CORPORATE / ELEGANT (Free) ─────────────────────────────

  (
    'corporate_001',
    'Driving Ambition',
    'Ahjay Stelino',
    'corporate',
    '💼',
    'spinshot/music/corporate_001',
    null,
    30,
    100,
    false
  ),

  -- ── CORPORATE / ELEGANT (Premium) ──────────────────────────

  (
    'corporate_002',
    'Discover',
    'Eugenio Mininni',
    'corporate',
    '💼',
    'spinshot/music/corporate_002',
    null,
    30,
    104,
    true
  ),
  (
    'corporate_003',
    'Boardroom Calm',
    'Lily J',
    'corporate',
    '💼',
    'spinshot/music/corporate_003',
    null,
    30,
    90,
    true
  ),

  -- ── CHILL / SMOOTH (Free) ───────────────────────────────────

  (
    'chill_001',
    'Serene View',
    'Arulo',
    'chill',
    '🌊',
    'spinshot/music/chill_001',
    null,
    30,
    82,
    false
  ),

  -- ── CHILL / SMOOTH (Premium) ───────────────────────────────

  (
    'chill_002',
    'Valley Sunset',
    'Alejandro Magaña',
    'chill',
    '🌊',
    'spinshot/music/chill_002',
    null,
    30,
    75,
    true
  ),
  (
    'chill_003',
    'Spirit in the Woods',
    'Alejandro Magaña',
    'chill',
    '🌊',
    'spinshot/music/chill_003',
    null,
    30,
    70,
    true
  ),
  (
    'chill_004',
    'Soft Glow',
    'Grigoriy Nuzhny',
    'chill',
    '🌊',
    'spinshot/music/chill_004',
    null,
    30,
    95,
    true
  )

on conflict (id) do update set
  title                = excluded.title,
  artist                = excluded.artist,
  category              = excluded.category,
  emoji                 = excluded.emoji,
  cloudinary_public_id  = excluded.cloudinary_public_id,
  preview_url           = excluded.preview_url,
  duration              = excluded.duration,
  bpm                   = excluded.bpm,
  is_premium            = excluded.is_premium;


-- ===========================================================
-- VERIFICATION QUERIES
-- Run these after seeding to confirm data was inserted:
-- ===========================================================
--
-- select count(*), is_default, is_premium
--   from public.video_frames
--   group by is_default, is_premium
--   order by is_default desc;
--
-- select id, title, category, bpm, is_premium
--   from public.music_tracks
--   order by is_premium, category, id;
--
-- ===========================================================
-- EXPECTED RESULT:
--   video_frames → 10 rows (5 free default + 5 premium default)
--   music_tracks → 15 rows (3 free + 12 premium across 4 categories)
-- ===========================================================


-- ===========================================================
-- CLOUDINARY UPLOAD CHECKLIST
-- ===========================================================
-- Before running this seed, upload your assets to Cloudinary:
--
-- FRAMES (PNG with transparency, 9:16 ratio recommended):
--   spinshot/frames/frame_party_001
--   spinshot/frames/frame_party_002
--   spinshot/frames/frame_wedding_001
--   spinshot/frames/frame_corporate_001
--   spinshot/frames/frame_default_001
--   spinshot/frames/frame_luxury_001
--   spinshot/frames/frame_galaxy_001
--   spinshot/frames/frame_holo_001
--   spinshot/frames/frame_wedding_002
--   spinshot/frames/frame_birthday_001
--
-- MUSIC (MP3, 128–180 seconds recommended):
--   spinshot/music/party_001   spinshot/music/party_002
--   spinshot/music/party_003   spinshot/music/party_004
--   spinshot/music/wedding_001 spinshot/music/wedding_002
--   spinshot/music/wedding_003 spinshot/music/wedding_004
--   spinshot/music/corporate_001 spinshot/music/corporate_002
--   spinshot/music/corporate_003 spinshot/music/corporate_004
--   spinshot/music/chill_001   spinshot/music/chill_002
--   spinshot/music/chill_003   spinshot/music/chill_004
--
-- Upload via Cloudinary Dashboard → Media Library → Upload
-- Or via CLI: cloudinary uploader upload <file> public_id=spinshot/music/party_001
-- ===========================================================
