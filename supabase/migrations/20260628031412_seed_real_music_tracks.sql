-- ===========================================================
-- SpinShot 360 — Real music tracks (replaces placeholder data)
-- ===========================================================
-- Mirrors the content of supabase/migrations/spinshot360_seed_tracks.sql
-- (section 2, "MUSIC TRACKS"), packaged with a timestamp-prefixed filename
-- so `supabase db push` can recognize and apply it — the original file
-- doesn't follow the "<timestamp>_name.sql" pattern Supabase expects.
--
-- 15 real tracks (3 free + 12 premium), sourced from Mixkit Free Stock
-- Music (https://mixkit.co/free-stock-music/) — free for commercial use,
-- no attribution required (https://mixkit.co/license/). Audio already
-- uploaded to Cloudinary via supabase/functions/upload-music.
-- Preview playback is capped to 30s via a Cloudinary so_0,eo_30
-- transformation (see services/musicService.ts buildCloudinaryPreviewUrl).
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
  title                 = excluded.title,
  artist                = excluded.artist,
  category              = excluded.category,
  emoji                 = excluded.emoji,
  cloudinary_public_id  = excluded.cloudinary_public_id,
  preview_url           = excluded.preview_url,
  duration              = excluded.duration,
  bpm                   = excluded.bpm,
  is_premium            = excluded.is_premium;
