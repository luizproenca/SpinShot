/**
 * SpinShot 360 — Clean-video reveal reconciliation
 *
 * The anti-refund hold (process-video's needsWatermarkSplit) stores a
 * watermarked variant alongside the clean one and a `clean_available_at`
 * timestamp on the video row. This job runs on a schedule (pg_cron, see
 * 20260805161500_schedule_reconcile_clean_video.sql) and, for every video
 * whose hold window has expired but hasn't been confirmed yet, re-checks
 * our own DB state — kept current by rc-webhook's refund handling — before
 * flipping `clean_confirmed_at`. That's what the client actually gates on
 * (see getDisplayVideoUrl in services/videoService.ts) instead of a pure
 * elapsed-time check that a refund landing mid-window could slip past.
 *
 * Internal-only: called by pg_cron with the same Bearer secret pattern
 * used elsewhere (INTERNAL_FUNCTION_SECRET), never by the app directly.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function verifyAuthorization(req: Request): boolean {
  const secret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
  if (!secret) {
    console.error('[reconcile-clean-video] INTERNAL_FUNCTION_SECRET not set — rejecting all requests');
    return false;
  }
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  return timingSafeEqual(token, secret);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!verifyAuthorization(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: pendingVideos, error: fetchError } = await supabaseAdmin
    .from('videos')
    .select('id, user_id, event_id, hold_reason')
    .is('clean_confirmed_at', null)
    .not('hold_reason', 'is', null)
    .not('clean_available_at', 'is', null)
    .lte('clean_available_at', new Date().toISOString())
    .limit(200);

  if (fetchError) {
    console.error('[reconcile-clean-video] fetch error:', fetchError.message);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let confirmed = 0;
  let held = 0;
  const candidateTrustUsers = new Set<string>();

  for (const video of pendingVideos ?? []) {
    let stillValid = false;

    if (video.hold_reason === 'purchase' && video.event_id) {
      // rc-webhook nulls unlock_source on this specific event the moment
      // a refund for its transaction is processed — if it's still
      // 'purchase' at expiry time, no refund landed.
      const { data: eventRow } = await supabaseAdmin
        .from('events')
        .select('unlock_source')
        .eq('id', video.event_id)
        .maybeSingle();
      stillValid = eventRow?.unlock_source === 'purchase';
    } else if (video.hold_reason === 'subscription') {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('subscription_plan, subscription_status, subscription_expires_at')
        .eq('id', video.user_id)
        .maybeSingle();

      const notExpired = !profile?.subscription_expires_at
        || new Date(profile.subscription_expires_at) > new Date();
      stillValid = !!profile
        && profile.subscription_plan !== 'free'
        && (profile.subscription_status === 'active' || profile.subscription_status === 'trial')
        && notExpired;
    }

    if (!stillValid) {
      held++;
      console.log(`[reconcile-clean-video] holding video=${video.id} reason=${video.hold_reason} (refund detected)`);
      continue;
    }

    const { error: confirmError } = await supabaseAdmin
      .from('videos')
      .update({ clean_confirmed_at: new Date().toISOString() })
      .eq('id', video.id);

    if (confirmError) {
      console.error(`[reconcile-clean-video] confirm failed for video ${video.id}:`, confirmError.message);
      continue;
    }

    confirmed++;
    candidateTrustUsers.add(video.user_id);
  }

  // First hold cycle to survive unrefunded graduates the account — every
  // future purchase/subscription for them skips the hold entirely.
  for (const userId of candidateTrustUsers) {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('trusted_purchaser_at')
      .eq('id', userId)
      .maybeSingle();

    if (profile && !profile.trusted_purchaser_at) {
      await supabaseAdmin
        .from('user_profiles')
        .update({ trusted_purchaser_at: new Date().toISOString() })
        .eq('id', userId);
    }
  }

  console.log(`[reconcile-clean-video] confirmed=${confirmed} held=${held} total=${(pendingVideos ?? []).length}`);

  return new Response(JSON.stringify({ ok: true, confirmed, held }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
