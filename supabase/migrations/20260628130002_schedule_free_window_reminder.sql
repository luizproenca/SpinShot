-- ===========================================================
-- SpinShot 360 — Daily cron for the free-window-ending reminder
-- ===========================================================
-- Schedules send-free-window-reminders to run once a day. The secret used
-- to authenticate the call lives in Supabase Vault (encrypted at rest),
-- never in this file.
--
-- IMPORTANT for disaster recovery / fresh environments: this migration
-- assumes a Vault secret named 'internal_function_secret' already exists
-- (it must match INTERNAL_FUNCTION_SECRET set via `supabase secrets set`
-- for the edge functions). If setting this up from scratch, run once,
-- with the real value, before this migration:
--   select vault.create_secret('<INTERNAL_FUNCTION_SECRET value>', 'internal_function_secret');
-- ===========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-free-window-reminders-daily')
where exists (select 1 from cron.job where jobname = 'send-free-window-reminders-daily');

select cron.schedule(
  'send-free-window-reminders-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://nlpzdxxbifpjwpywwiof.supabase.co/functions/v1/send-free-window-reminders',
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
