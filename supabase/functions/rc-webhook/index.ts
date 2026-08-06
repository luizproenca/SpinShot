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
    // Only present on CANCELLATION events. CUSTOMER_SUPPORT is the one
    // value that means an actual refund/chargeback — the others are
    // voluntary cancels, billing failures, etc. and must NOT count as
    // a refund for the anti-abuse escalation (item 7).
    cancel_reason?:
      | 'UNSUBSCRIBE'
      | 'BILLING_ERROR'
      | 'DEVELOPER_INITIATED'
      | 'PRICE_INCREASE'
      | 'CUSTOMER_SUPPORT'
      | null;
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

const EVENT_PASS_PRODUCT_ID = 'com.ironman.spinshot.app.event.pass';

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
      return null;

    default:
      console.warn('[rc-webhook] Unknown event type:', type);
      return null;
  }
}

// ─── Verify webhook authorization ─────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function verifyAuthorization(req: Request): boolean {
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

  // Fail CLOSED if no secret is configured — this used to fail open ("allow
  // if no secret set"), which meant the webhook had no real auth at all,
  // since REVENUECAT_WEBHOOK_SECRET was never actually set.
  if (!webhookSecret) {
    console.error('[rc-webhook] REVENUECAT_WEBHOOK_SECRET not set — rejecting all requests');
    return false;
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  return timingSafeEqual(token, webhookSecret);
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

  // ── Supabase admin client ──────────────────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── One-off event-pass purchase — audit log only ───────────────────────────
  // The actual unlock is granted synchronously by validate-purchase's
  // 'unlock_event' action right after the client's purchase call (same
  // pattern as rc_validate for subscriptions) — RC's webhook payload has no
  // eventId to correlate against, so this is a reconciliation trail, not
  // the primary grant mechanism. Never touches user_profiles.
  if (rcEvent.type === 'NON_RENEWING_PURCHASE') {
    const { error: logError } = await supabaseAdmin.from('subscription_events').insert({
      user_id:        userId,
      event_type:     'event_pass_purchased_rc',
      plan:           null,
      platform:       mapPlatform(rcEvent.store),
      purchase_token: rcEvent.transaction_id ?? null,
    });

    if (logError) {
      console.warn(`[rc-webhook] Failed to log NON_RENEWING_PURCHASE for user ${userId}:`, logError.message);
    }

    return new Response(JSON.stringify({ ok: true, event: 'event_pass_purchased_rc' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Refund / chargeback ────────────────────────────────────────────────────
  // RC reuses CANCELLATION for both a voluntary cancel and an actual refund
  // — cancel_reason is what tells them apart. Only CUSTOMER_SUPPORT means
  // money actually came back (Apple/Google/RC-billing refund).
  const isRefund = rcEvent.type === 'CANCELLATION' && rcEvent.cancel_reason === 'CUSTOMER_SUPPORT';

  if (isRefund && rcEvent.product_id === EVENT_PASS_PRODUCT_ID) {
    // One-off event pass refunded — revoke that specific event's unlock.
    // purchase_transaction_id is left untouched (protected column, see
    // 20260805133017_event_pass_fraud_hardening.sql) so this exact
    // transaction can never be matched as "available" again in
    // validate-purchase's unlock_event.
    const transactionId = rcEvent.transaction_id ?? rcEvent.original_transaction_id;

    if (transactionId) {
      const { data: refundedEvent, error: findError } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('purchase_transaction_id', transactionId)
        .eq('unlock_source', 'purchase')
        .maybeSingle();

      if (findError) {
        console.error(`[rc-webhook] Failed to look up refunded event for user ${userId}:`, findError.message);
      } else if (refundedEvent) {
        const { error: revokeError } = await supabaseAdmin
          .from('events')
          .update({ unlock_source: null, unlocked_at: null })
          .eq('id', refundedEvent.id);

        if (revokeError) {
          console.error(`[rc-webhook] Failed to revoke event ${refundedEvent.id}:`, revokeError.message);
        } else {
          console.log(`[rc-webhook] ✓ Revoked event pass unlock: event=${refundedEvent.id} user=${userId}`);
        }
      } else {
        // Already revoked, or the transaction never matched an event
        // (e.g. it lost the double-spend race in unlock_event). Not an
        // error — still counts toward refund_count below.
        console.warn(`[rc-webhook] Refunded event-pass transaction not matched to any unlocked event: user=${userId} tx=${transactionId}`);
      }
    } else {
      console.warn(`[rc-webhook] Event pass refund with no transaction_id: user=${userId}`);
    }

    const { error: rpcError } = await supabaseAdmin.rpc('increment_refund_count', { p_user_id: userId });
    if (rpcError) {
      console.error(`[rc-webhook] Failed to increment refund_count for user ${userId}:`, rpcError.message);
    }

    const { error: refundLogError } = await supabaseAdmin.from('subscription_events').insert({
      user_id:        userId,
      event_type:     'event_pass_refunded',
      plan:           null,
      platform:       mapPlatform(rcEvent.store),
      purchase_token: transactionId ?? null,
    });
    if (refundLogError) {
      console.warn(`[rc-webhook] Failed to log event_pass_refunded for user ${userId}:`, refundLogError.message);
    }

    return new Response(JSON.stringify({ ok: true, event: 'event_pass_refunded' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (isRefund) {
    // Subscription refund — bump refund_count on top of the normal
    // cancelled-plan sync below (buildSyncResult already sets the account
    // to 'cancelled' with expiresAt taken from RC, which reflects the
    // refund's immediate revocation on Apple/Google's side).
    const { error: rpcError } = await supabaseAdmin.rpc('increment_refund_count', { p_user_id: userId });
    if (rpcError) {
      console.error(`[rc-webhook] Failed to increment refund_count for user ${userId}:`, rpcError.message);
    }
  }

  // ── Build sync result ──────────────────────────────────────────────────────
  const syncResult = buildSyncResult(rcEvent);

  if (!syncResult) {
    console.log(`[rc-webhook] No sync needed for event type: ${rcEvent.type}`);
    return new Response(JSON.stringify({ ok: true, skipped: rcEvent.type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
