-- ===========================================================
-- SpinShot 360 — Remove the 30-day free-window reminder cron
-- ===========================================================
-- The account-wide 30-day reverse trial (see 20260628125402_free_window.sql
-- and 20260628130002_schedule_free_window_reminder.sql) has been replaced
-- by a narrower per-event model (20260804142000_event_entitlement.sql):
-- the first event a new account creates is free, instead of a rolling
-- 30-day full-Pro window on the account. There is no more "window ending
-- soon" reminder to send.
select cron.unschedule('send-free-window-reminders-daily')
where exists (select 1 from cron.job where jobname = 'send-free-window-reminders-daily');
