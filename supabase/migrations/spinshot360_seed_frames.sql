-- =============================================================
-- SpinShot 360 – Seed Data (Initial Content)
-- Target: Supabase (self-managed or Supabase Cloud)
-- Run AFTER: spinshot360_full_migration.sql
-- =============================================================
-- This script inserts:
--   1. Default video frames (is_default = true, visible to all users)
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

--
-- Upload via Cloudinary Dashboard → Media Library → Upload
-- Or via CLI: cloudinary uploader upload <file> public_id=spinshot/music/party_001
-- ===========================================================
