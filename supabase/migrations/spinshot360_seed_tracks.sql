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
--   https://res.cloudinary.com/<cloud>/video/upload/<cloudinary_public_id>.mp3
-- So preview_url can be null — it is computed by buildCloudinaryPreviewUrl().
--
-- IMPORTANT: Upload your .mp3 files to Cloudinary and replace
-- the cloudinary_public_id placeholders with your real values.
-- ===========================================================

insert into public.music_tracks
  (id, title, artist, category, emoji, cloudinary_public_id, preview_url, duration, bpm, is_premium)
values

  -- ── PARTY / ENERGY (Free) ──────────────────────────────────

  (
    'party_001',
    'Festival Energy',
    'SpinShot Beats',
    'party',
    '🎉',
    'spinshot/music/party_001',    -- ← Replace with your Cloudinary public_id
    null,
    128,
    128,
    false
  ),
  (
    'party_002',
    'Neon Rush',
    'SpinShot Beats',
    'party',
    '🎉',
    'spinshot/music/party_002',    -- ← Replace with your Cloudinary public_id
    null,
    95,
    140,
    false
  ),

  -- ── PARTY / ENERGY (Premium) ───────────────────────────────

  (
    'party_003',
    'Ultra Drop',
    'SpinShot Beats',
    'party',
    '🎉',
    'spinshot/music/party_003',    -- ← Replace with your Cloudinary public_id
    null,
    110,
    150,
    true
  ),
  (
    'party_004',
    'Confetti Blast',
    'SpinShot Beats',
    'party',
    '🎉',
    'spinshot/music/party_004',    -- ← Replace with your Cloudinary public_id
    null,
    105,
    135,
    true
  ),

  -- ── WEDDING / EMOTIONAL (Free) ─────────────────────────────

  (
    'wedding_001',
    'Eternal Waltz',
    'SpinShot Beats',
    'wedding',
    '💍',
    'spinshot/music/wedding_001',  -- ← Replace with your Cloudinary public_id
    null,
    180,
    72,
    false
  ),
  (
    'wedding_002',
    'Golden Moment',
    'SpinShot Beats',
    'wedding',
    '💍',
    'spinshot/music/wedding_002',  -- ← Replace with your Cloudinary public_id
    null,
    165,
    68,
    false
  ),

  -- ── WEDDING / EMOTIONAL (Premium) ─────────────────────────

  (
    'wedding_003',
    'Forever After',
    'SpinShot Beats',
    'wedding',
    '💍',
    'spinshot/music/wedding_003',  -- ← Replace with your Cloudinary public_id
    null,
    200,
    64,
    true
  ),
  (
    'wedding_004',
    'Diamond Vows',
    'SpinShot Beats',
    'wedding',
    '💍',
    'spinshot/music/wedding_004',  -- ← Replace with your Cloudinary public_id
    null,
    190,
    70,
    true
  ),

  -- ── CORPORATE / ELEGANT (Free) ─────────────────────────────

  (
    'corporate_001',
    'Executive Suite',
    'SpinShot Beats',
    'corporate',
    '💼',
    'spinshot/music/corporate_001', -- ← Replace with your Cloudinary public_id
    null,
    120,
    95,
    false
  ),
  (
    'corporate_002',
    'Power Pitch',
    'SpinShot Beats',
    'corporate',
    '💼',
    'spinshot/music/corporate_002', -- ← Replace with your Cloudinary public_id
    null,
    115,
    100,
    false
  ),

  -- ── CORPORATE / ELEGANT (Premium) ─────────────────────────

  (
    'corporate_003',
    'Summit Drive',
    'SpinShot Beats',
    'corporate',
    '💼',
    'spinshot/music/corporate_003', -- ← Replace with your Cloudinary public_id
    null,
    130,
    105,
    true
  ),
  (
    'corporate_004',
    'Prestige Mode',
    'SpinShot Beats',
    'corporate',
    '💼',
    'spinshot/music/corporate_004', -- ← Replace with your Cloudinary public_id
    null,
    125,
    98,
    true
  ),

  -- ── CHILL / SMOOTH (Free) ─────────────────────────────────

  (
    'chill_001',
    'Sunset Flow',
    'SpinShot Beats',
    'chill',
    '🌊',
    'spinshot/music/chill_001',    -- ← Replace with your Cloudinary public_id
    null,
    150,
    85,
    false
  ),
  (
    'chill_002',
    'Ocean Breeze',
    'SpinShot Beats',
    'chill',
    '🌊',
    'spinshot/music/chill_002',    -- ← Replace with your Cloudinary public_id
    null,
    145,
    80,
    false
  ),

  -- ── CHILL / SMOOTH (Premium) ──────────────────────────────

  (
    'chill_003',
    'Midnight Drift',
    'SpinShot Beats',
    'chill',
    '🌊',
    'spinshot/music/chill_003',    -- ← Replace with your Cloudinary public_id
    null,
    160,
    78,
    true
  ),
  (
    'chill_004',
    'Cloud Nine',
    'SpinShot Beats',
    'chill',
    '🌊',
    'spinshot/music/chill_004',    -- ← Replace with your Cloudinary public_id
    null,
    155,
    76,
    true
  )

on conflict (id) do nothing;


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
--   music_tracks → 16 rows (8 free + 8 premium across 4 categories)
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
