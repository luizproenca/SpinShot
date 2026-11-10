-- ===========================================================
-- SpinShot 360 — Run the temp-upload cleanup live from the cron
-- ===========================================================
-- expire-free-videos now also deletes raw uploads left behind in the
-- Supabase Storage bucket spinshot-videos (failed/cancelled processing
-- never cleaned them; 1.1 GB had piled up). That sweep is tightly
-- scoped (<uuid>/<digits>.<video ext>, older than 6h, not referenced by
-- any video) so it runs live every day, while the free-video expiry
-- stays in dry run until the app build with the expiry notice is out.
--
-- Re-schedules the existing job with storage_dry_run=false. The "go live"
-- replace() at the bottom of 20260809120000_cloudinary_retention.sql
-- still works: it only flips '"dry_run": true'.

select cron.unschedule('expire-free-videos-daily')
where exists (select 1 from cron.job where jobname = 'expire-free-videos-daily');

select cron.schedule(
  'expire-free-videos-daily',
  '15 4 * * *',
  $$
  select net.http_post(
    url := 'https://nlpzdxxbifpjwpywwiof.supabase.co/functions/v1/expire-free-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'internal_function_secret'
      )
    ),
    body := '{"dry_run": true, "storage_dry_run": false}'::jsonb
  );
  $$
);
