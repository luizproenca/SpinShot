-- ===========================================================
-- SpinShot 360 — Hourly cron for reconcile-clean-video
-- ===========================================================
-- The anti-refund hold is 48h, so hourly is plenty responsive without
-- extra load. Same vault-secret auth pattern as the old free-window
-- reminder cron (20260628130002_schedule_free_window_reminder.sql) —
-- assumes the 'internal_function_secret' Vault entry already exists.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('reconcile-clean-video-hourly')
where exists (select 1 from cron.job where jobname = 'reconcile-clean-video-hourly');

select cron.schedule(
  'reconcile-clean-video-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://nlpzdxxbifpjwpywwiof.supabase.co/functions/v1/reconcile-clean-video',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'internal_function_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
