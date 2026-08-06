-- ===========================================================
-- SpinShot 360 — Watermarked/clean video split (event-pass anti-refund)
-- ===========================================================
-- Only used for videos processed under an event unlocked via one-off
-- purchase (unlock_source = 'purchase'). Both stores allow an easy
-- refund shortly after purchase, and the final render (watermark baked
-- into the file at process time) can't be clawed back once delivered —
-- so for purchased events, `video_url` initially points at the
-- watermarked render, `video_url_watermarked` keeps that same URL for
-- reference, and the app switches display/download to the already-
-- generated clean render once `clean_available_at` has passed. No
-- reprocessing job needed: both URLs are Cloudinary transformation
-- strings built from the same underlying asset, not separate renders.
alter table public.videos
  add column if not exists video_url_watermarked text,
  add column if not exists clean_available_at     timestamptz;
