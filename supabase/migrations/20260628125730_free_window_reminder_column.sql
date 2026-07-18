-- Tracks whether the "your free period is ending soon" push was already
-- sent for this account, so the daily job never double-sends it.
alter table public.user_profiles
  add column if not exists free_window_reminder_sent_at timestamptz;
