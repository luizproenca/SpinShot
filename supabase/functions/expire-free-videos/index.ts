/**
 * SpinShot 360 — Cloudinary retention job
 *
 * Cloudinary is only a processing engine + short-term host for free
 * users; paid users keep their videos. Internal-only (pg_cron, Bearer
 * INTERNAL_FUNCTION_SECRET), same pattern as reconcile-clean-video.
 *
 * Body (all optional):
 *   dry_run        boolean  default TRUE — report only, delete nothing
 *   retention_days number   default FREE_RETENTION_DAYS env or 30
 *   orphans        boolean  default false — also sweep raw originals
 *                           (spinshot/<uuid>/video_<ts>, no "_fx") that
 *                           older versions of process-video never deleted
 *   cursor         string   Cloudinary next_cursor to continue an orphan scan
 *
 * Steps per run:
 *   1. Drain cloudinary_deletion_queue (rows enqueued by the DELETE
 *      trigger on public.videos: manual deletes, account deletion).
 *   2. Expire free videos older than retention_days: delete the asset
 *      from Cloudinary, null the URLs, set expired_at. A video is KEPT
 *      if its owner has an active subscription, its event was unlocked by
 *      a purchased event pass, or an anti-refund hold is in flight.
 *   3. (orphans=true) delete raw originals older than 1h.
 *
 * Every delete is restricted to public_ids matching
 * spinshot/<uuid>/video_<digits>[_fx] — music, frames and anything else
 * in the account can never be touched by this function.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '';
const API_KEY = Deno.env.get('CLOUDINARY_API_KEY') ?? '';
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

const DEFAULT_RETENTION_DAYS = Number(Deno.env.get('FREE_RETENTION_DAYS') ?? '30');
const EXPIRE_BATCH = 200;
const QUEUE_BATCH = 200;
const ORPHAN_PAGES = 10; // × 500 resources per page per run
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const FX_ID = /^spinshot\/[0-9a-fA-F-]{36}\/video_[0-9]+_fx$/;
const RAW_ID = /^spinshot\/[0-9a-fA-F-]{36}\/video_[0-9]+$/;

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function verifyAuthorization(req: Request): boolean {
  const secret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
  if (!secret) {
    console.error('[expire-free-videos] INTERNAL_FUNCTION_SECRET not set — rejecting all requests');
    return false;
  }
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  return timingSafeEqual(token, secret);
}

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signed destroy. Returns 'ok' | 'not found'; throws on anything else. */
async function destroyAsset(publicId: string): Promise<'ok' | 'not found'> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await sha1Hex(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', API_KEY);
  form.append('timestamp', timestamp);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/destroy`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`destroy HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.result === 'ok' || body.result === 'not found') return body.result;
  throw new Error(`destroy unexpected result: ${JSON.stringify(body)}`);
}

const adminAuth = () => 'Basic ' + btoa(`${API_KEY}:${API_SECRET}`);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!verifyAuthorization(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders });
  }
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return new Response(JSON.stringify({ error: 'Cloudinary credentials not configured' }), {
      status: 500, headers: jsonHeaders,
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const dryRun = body.dry_run !== false; // anything but an explicit false is a dry run
  const retentionDays = Number(body.retention_days) > 0 ? Number(body.retention_days) : DEFAULT_RETENTION_DAYS;
  const sweepOrphans = body.orphans === true;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const report: Record<string, unknown> = { dry_run: dryRun, retention_days: retentionDays };

  // ── 1. Drain deletion queue ──────────────────────────────────────────
  {
    const { data: queued, error } = await supabase
      .from('cloudinary_deletion_queue')
      .select('id, public_id, attempts')
      .lt('attempts', 5)
      .order('id')
      .limit(QUEUE_BATCH);
    if (error) console.error('[expire-free-videos] queue fetch:', error.message);

    let deleted = 0;
    let failed = 0;
    for (const item of queued ?? []) {
      if (!FX_ID.test(item.public_id)) {
        // Should be impossible (trigger filters), but never trust the queue blindly.
        if (!dryRun) await supabase.from('cloudinary_deletion_queue').delete().eq('id', item.id);
        continue;
      }
      if (dryRun) { deleted++; continue; }
      try {
        await destroyAsset(item.public_id);
        await supabase.from('cloudinary_deletion_queue').delete().eq('id', item.id);
        deleted++;
      } catch (e: any) {
        failed++;
        await supabase.from('cloudinary_deletion_queue')
          .update({ attempts: item.attempts + 1, last_error: String(e?.message ?? e).slice(0, 500) })
          .eq('id', item.id);
      }
    }
    report.queue = { pending_seen: queued?.length ?? 0, deleted, failed };
  }

  // ── 2. Expire free videos ────────────────────────────────────────────
  {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates, error } = await supabase
      .from('videos')
      .select('id, user_id, event_id, video_url, created_at')
      .is('expired_at', null)
      .is('hold_reason', null)
      .not('video_url', 'is', null)
      .lt('created_at', cutoff)
      .order('created_at')
      .limit(EXPIRE_BATCH);

    if (error) {
      console.error('[expire-free-videos] candidates fetch:', error.message);
      report.expire = { error: error.message };
    } else {
      const rows = candidates ?? [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))];

      const { data: profiles } = userIds.length
        ? await supabase.from('user_profiles')
            .select('id, subscription_plan, subscription_status, subscription_expires_at')
            .in('id', userIds)
        : { data: [] as any[] };
      const { data: events } = eventIds.length
        ? await supabase.from('events').select('id, unlock_source').in('id', eventIds as string[])
        : { data: [] as any[] };

      const paidUsers = new Set<string>();
      for (const p of profiles ?? []) {
        const notExpired = !p.subscription_expires_at || new Date(p.subscription_expires_at) > new Date();
        if (p.subscription_plan !== 'free'
          && (p.subscription_status === 'active' || p.subscription_status === 'trial')
          && notExpired) paidUsers.add(p.id);
      }
      const purchasedEvents = new Set<string>(
        (events ?? []).filter((e: any) => e.unlock_source === 'purchase').map((e: any) => e.id),
      );

      let kept = 0, expired = 0, failed = 0, skippedBadId = 0;
      for (const v of rows) {
        if (paidUsers.has(v.user_id) || (v.event_id && purchasedEvents.has(v.event_id))) { kept++; continue; }

        const pid = /\/f_mp4\/([^?]+)\.mp4/.exec(v.video_url ?? '')?.[1];
        if (!pid || !FX_ID.test(pid)) { skippedBadId++; continue; }

        if (dryRun) { expired++; continue; }
        try {
          await destroyAsset(pid);
          const { error: upErr } = await supabase.from('videos').update({
            video_url: null,
            share_url: null,
            thumbnail_uri: null,
            video_url_watermarked: null,
            expired_at: new Date().toISOString(),
          }).eq('id', v.id);
          if (upErr) throw new Error(upErr.message);
          expired++;
        } catch (e: any) {
          failed++;
          console.error('[expire-free-videos] expire failed', v.id, e?.message ?? e);
        }
      }
      report.expire = {
        candidates: rows.length,
        would_expire_or_expired: expired,
        kept_paid: kept,
        skipped_unparseable_url: skippedBadId,
        failed,
        more_pending: rows.length === EXPIRE_BATCH,
      };
    }
  }

  // ── 3. Orphan raw originals (never deleted by older process-video) ───
  if (sweepOrphans) {
    let cursor: string | undefined = typeof body.cursor === 'string' ? body.cursor : undefined;
    let scanned = 0, orphanCount = 0, orphanBytes = 0, deleted = 0, failed = 0;
    const sample: string[] = [];

    for (let page = 0; page < ORPHAN_PAGES; page++) {
      const qs = new URLSearchParams({ prefix: 'spinshot/', max_results: '500' });
      if (cursor) qs.set('next_cursor', cursor);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video/upload?${qs}`,
        { headers: { Authorization: adminAuth() } },
      );
      if (!res.ok) {
        report.orphans_error = `list HTTP ${res.status}: ${await res.text()}`;
        break;
      }
      const data = await res.json();
      const resources: any[] = data.resources ?? [];
      scanned += resources.length;

      const orphans = resources.filter((r) =>
        RAW_ID.test(r.public_id)
        && Date.now() - new Date(r.created_at).getTime() > ORPHAN_MIN_AGE_MS);

      for (const o of orphans) {
        orphanCount++;
        orphanBytes += Number(o.bytes ?? 0);
        if (sample.length < 5) sample.push(o.public_id);
      }

      if (!dryRun) {
        for (let i = 0; i < orphans.length; i += 100) {
          const chunk = orphans.slice(i, i + 100).map((o) => o.public_id);
          const dq = new URLSearchParams();
          chunk.forEach((id) => dq.append('public_ids[]', id));
          const del = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video/upload?${dq}`,
            { method: 'DELETE', headers: { Authorization: adminAuth() } },
          );
          if (del.ok) deleted += chunk.length;
          else { failed += chunk.length; console.error('[expire-free-videos] orphan delete', del.status, await del.text()); }
        }
      }

      cursor = data.next_cursor;
      if (!cursor) break;
    }

    report.orphans = {
      scanned,
      orphan_originals: orphanCount,
      orphan_mb: Math.round((orphanBytes / 1024 / 1024) * 10) / 10,
      deleted,
      failed,
      sample,
      next_cursor: cursor ?? null,
    };
  }

  console.log('[expire-free-videos]', JSON.stringify(report));
  return new Response(JSON.stringify(report), { status: 200, headers: jsonHeaders });
});
