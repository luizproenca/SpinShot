/**
 * SpinShot 360 — RevenueCat Webhook Handler
 *
 * Receives server-side subscription events from RevenueCat and syncs
 * user_profiles + subscription_events in Supabase automatically.
 *
 * Supported events:
 *   INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION,
 *   UNCANCELLATION, EXPIRATION, BILLING_ISSUE, SUBSCRIBER_ALIAS
 *
 * Configuration in RevenueCat Dashboard → Project Settings → Webhooks:
 *   URL: https://<your-project>.backend.onspace.ai/functions/v1/rc-webhook
 *   Authorization header: Bearer <REVENUECAT_WEBHOOK_SECRET>
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RCWebhookEvent {
  event: {
    aliases: string[];
    app_id: string;
    app_user_id: string;               // Supabase user ID (we set it as RC app user id)
    commission_percentage: number | null;
    country_code: string | null;
    currency: string | null;
    entitlement_ids: string[] | null;
    environment: 'PRODUCTION' | 'SANDBOX';
    event_timestamp_ms: number;
    expiration_at_ms: number | null;
    id: string;
    is_family_share: boolean;
    offer_code: string | null;
    original_app_user_id: string;
    original_transaction_id: string | null;
    period_type: 'NORMAL' | 'TRIAL' | 'INTRO';
    presented_offering_id: string | null;
    price: number | null;
    price_in_purchased_currency: number | null;
    product_id: string;
    purchased_at_ms: number;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    subscriber_attributes: Record<string, any>;
    transaction_id: string | null;
    type:
      | 'INITIAL_PURCHASE'
      | 'RENEWAL'
      | 'PRODUCT_CHANGE'
      | 'CANCELLATION'
      | 'UNCANCELLATION'
      | 'EXPIRATION'
      | 'BILLING_ISSUE'
      | 'SUBSCRIBER_ALIAS'
      | 'TRANSFER'
      | 'NON_RENEWING_PURCHASE';
  };
  api_version: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapProductToPlan(productId: string): 'pro_monthly' | 'pro_annual' | 'free' {
  if (productId.includes('monthly')) return 'pro_monthly';
  if (productId.includes('annual'))  return 'pro_annual';
  return 'free';
}

function mapPlatform(store: string): string {
  if (store === 'APP_STORE')  return 'ios';
  if (store === 'PLAY_STORE') return 'android';
  if (store === 'STRIPE')     return 'web';
  return store.toLowerCase();
}

interface SyncResult {
  plan: string;
  status: string;
  expiresAt: string | null;
  eventType: string;
  isTrial: boolean;
}

function buildSyncResult(event: RCWebhookEvent['event']): SyncResult | null {
  const { type, product_id, expiration_at_ms, period_type } = event;
  const plan = mapProductToPlan(product_id);
  const expiresAt = expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null;
  const isTrial = period_type === 'TRIAL';

  switch (type) {
    case 'INITIAL_PURCHASE':
      return {
        plan,
        status: isTrial ? 'trial' : 'active',
        expiresAt,
        eventType: isTrial ? 'trial_started' : 'subscription_activated',
        isTrial,
      };

    case 'RENEWAL':
      return {
        plan,
        status: 'active',
        expiresAt,
        eventType: 'subscription_renewed',
        isTrial: false,
      };

    case 'PRODUCT_CHANGE':
      return {
        plan,
        status: 'active',
        expiresAt,
        eventType: 'subscription_changed',
        isTrial: false,
      };

    case 'UNCANCELLATION':
      return {
        plan,
        status: 'active',
        expiresAt,
        eventType: 'subscription_uncancelled',
        isTrial: false,
      };

    case 'CANCELLATION':
      // User cancelled but still has access until expiration
      return {
        plan,
        status: 'cancelled',
        expiresAt,
        eventType: 'subscription_cancelled',
        isTrial: false,
      };

    case 'EXPIRATION':
      return {
        plan:     'free',
        status:   'expired',
        expiresAt: null,
        eventType: 'subscription_expired',
        isTrial:  false,
      };

    case 'BILLING_ISSUE':
      // Keep plan active but flag the issue — RC will retry billing
      return {
        plan,
        status:   'active',
        expiresAt,
        eventType: 'billing_issue',
        isTrial:  false,
      };

    // No state change needed for these
    case 'SUBSCRIBER_ALIAS':
    case 'TRANSFER':
    case 'NON_RENEWING_PURCHASE':
      return null;

    default:
      console.warn('[rc-webhook] Unknown event type:', type);
      return null;
  }
}

// ─── Verify webhook authorization ─────────────────────────────────────────────

function verifyAuthorization(req: Request): boolean {
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

  // If no secret is configured, allow (dev mode) — log a warning
  if (!webhookSecret) {
    console.warn('[rc-webhook] REVENUECAT_WEBHOOK_SECRET not set — skipping auth verification');
    return true;
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  return token === webhookSecret;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // RevenueCat sends POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Auth verification ──────────────────────────────────────────────────────
  if (!verifyAuthorization(req)) {
    console.error('[rc-webhook] Unauthorized request');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: RCWebhookEvent;

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rcEvent = payload?.event;
  if (!rcEvent) {
    return new Response(JSON.stringify({ error: 'Missing event object' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ignore SANDBOX events in production (optional — comment out to allow testing)
  if (rcEvent.environment === 'SANDBOX') {
    console.log(`[rc-webhook] Ignoring sandbox event: ${rcEvent.type}`);
    return new Response(JSON.stringify({ ok: true, ignored: 'sandbox' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = rcEvent.app_user_id || rcEvent.original_app_user_id;

  if (!userId) {
    console.error('[rc-webhook] No user ID in event:', rcEvent.id);
    return new Response(JSON.stringify({ error: 'No user ID in event' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[rc-webhook] ${rcEvent.type} user=${userId} product=${rcEvent.product_id} env=${rcEvent.environment}`);

  // ── Build sync result ──────────────────────────────────────────────────────
  const syncResult = buildSyncResult(rcEvent);

  if (!syncResult) {
    console.log(`[rc-webhook] No sync needed for event type: ${rcEvent.type}`);
    return new Response(JSON.stringify({ ok: true, skipped: rcEvent.type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Supabase admin client ──────────────────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── Verify user exists ─────────────────────────────────────────────────────
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, subscription_plan, subscription_status, trial_start_at')
    .eq('id', userId)
    .single();

  if (profileError || !userProfile) {
    // RC may send events for users who deleted their accounts — log and skip
    console.warn(`[rc-webhook] User not found: ${userId}`, profileError?.message);
    return new Response(JSON.stringify({ ok: true, skipped: 'user_not_found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Update user_profiles ───────────────────────────────────────────────────
  const updateData: Record<string, any> = {
    subscription_plan:       syncResult.plan,
    subscription_status:     syncResult.status,
    subscription_expires_at: syncResult.expiresAt,
    store_platform:          mapPlatform(rcEvent.store),
    purchase_token:          rcEvent.transaction_id ?? null,
  };

  // Set trial_start_at only on first trial
  if (syncResult.isTrial && !userProfile.trial_start_at) {
    updateData.trial_start_at = new Date(rcEvent.purchased_at_ms).toISOString();
  }

  // On expiration/cancellation with free plan — clear expiry
  if (syncResult.plan === 'free') {
    updateData.subscription_expires_at = null;
  }

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update(updateData)
    .eq('id', userId);

  if (updateError) {
    console.error(`[rc-webhook] DB update error for user ${userId}:`, updateError.message);
    // Return 200 to prevent RC from retrying endlessly for DB errors
    return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Log to subscription_events ─────────────────────────────────────────────
  const { error: logError } = await supabaseAdmin
    .from('subscription_events')
    .insert({
      user_id:        userId,
      event_type:     syncResult.eventType,
      plan:           syncResult.plan !== 'free' ? syncResult.plan : null,
      platform:       mapPlatform(rcEvent.store),
      purchase_token: rcEvent.transaction_id ?? null,
    });

  if (logError) {
    console.warn(`[rc-webhook] Failed to log event for user ${userId}:`, logError.message);
    // Non-fatal — still return success
  }

  console.log(`[rc-webhook] ✓ Synced user=${userId} plan=${syncResult.plan} status=${syncResult.status} event=${syncResult.eventType}`);

  return new Response(JSON.stringify({
    ok:     true,
    userId,
    plan:   syncResult.plan,
    status: syncResult.status,
    event:  syncResult.eventType,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
