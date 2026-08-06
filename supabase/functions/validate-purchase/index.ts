import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── RevenueCat REST API helper ───────────────────────────────────────────────

const RC_API_BASE = 'https://api.revenuecat.com/v1';

async function fetchRCSubscriber(appUserId: string): Promise<any> {
  const rcSecretKey = Deno.env.get('REVENUECAT_API_KEY') ?? '';
  if (!rcSecretKey) throw new Error('RevenueCat: REVENUECAT_API_KEY not configured');

  const res = await fetch(`${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      'Authorization': `Bearer ${rcSecretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RevenueCat API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Determine if the RC subscriber has an active 'pro' entitlement.
 */
function parseRCSubscriberStatus(subscriber: any): {
  isPro: boolean;
  isTrial: boolean;
  plan: string;
  expiresAt: string | null;
} {
  const entitlements = subscriber?.subscriber?.entitlements ?? {};
  const proEnt = entitlements['pro'];

  if (!proEnt) {
    return { isPro: false, isTrial: false, plan: 'free', expiresAt: null };
  }

  const expiresDate = proEnt.expires_date ? new Date(proEnt.expires_date) : null;
  const isPro = expiresDate ? expiresDate > new Date() : false;

  const subscriptions = subscriber?.subscriber?.subscriptions ?? {};
  let isTrial = false;
  let plan = 'free';

  for (const [productId, sub] of Object.entries(subscriptions)) {
    const s = sub as any;
    if (!s.expires_date) continue;
    if (new Date(s.expires_date) <= new Date()) continue;

    if (productId.includes('monthly')) plan = 'pro_monthly';
    else if (productId.includes('annual')) plan = 'pro_annual';

    if (s.period_type === 'trial') isTrial = true;
  }

  if (!isPro) plan = 'free';

  return { isPro, isTrial, plan, expiresAt: proEnt.expires_date ?? null };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── GET_CONFIG — public endpoint, no auth required ────────────────────────
    // Returns the platform-specific RevenueCat public SDK key stored server-side.
    if (action === 'get_config') {
      const platform = body.platform ?? 'ios';
      const key = platform === 'android'
        ? (Deno.env.get('EXPO_PUBLIC_RC_ANDROID_KEY') ?? '')
        : (Deno.env.get('EXPO_PUBLIC_RC_IOS_KEY') ?? '');

      return new Response(JSON.stringify({ key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── All other actions require authentication ───────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── RC_VALIDATE — verify CustomerInfo from SDK against RC REST API ────────
    if (action === 'rc_validate') {
      try {
        const subscriber = await fetchRCSubscriber(user.id);
        const { isPro, isTrial, plan, expiresAt } = parseRCSubscriberStatus(subscriber);

        const now = new Date();
        let status: string;
        if (!isPro) status = 'inactive';
        else if (isTrial) status = 'trial';
        else status = 'active';

        const updateData: Record<string, any> = {
          subscription_plan:       plan,
          subscription_status:     status,
          subscription_expires_at: expiresAt,
        };

        if (isTrial) {
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('trial_start_at')
            .eq('id', user.id)
            .single();
          if (!profile?.trial_start_at) {
            updateData.trial_start_at = now.toISOString();
          }
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update(updateData)
          .eq('id', user.id);

        if (updateError) throw updateError;

        if (isPro) {
          await supabaseAdmin.from('subscription_events').insert({
            user_id:        user.id,
            event_type:     isTrial ? 'trial_rc_validated' : 'subscription_rc_validated',
            plan,
            platform:       body.platform ?? 'unknown',
            purchase_token: null,
          });
        }

        console.log(`[validate-purchase] rc_validate user=${user.id} isPro=${isPro} plan=${plan} trial=${isTrial}`);

        return new Response(JSON.stringify({ success: true, isPro, isTrial, plan, status, expiresAt }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (rcErr: any) {
        console.error('[validate-purchase] RC API error:', rcErr.message);
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('subscription_plan, subscription_status, subscription_expires_at, trial_start_at')
          .eq('id', user.id)
          .single();

        const isPro = (profile?.subscription_status === 'active' || profile?.subscription_status === 'trial')
          && profile?.subscription_plan !== 'free';

        return new Response(JSON.stringify({
          success: false,
          rcError: rcErr.message,
          isPro,
          isTrial:  profile?.subscription_status === 'trial',
          plan:     profile?.subscription_plan ?? 'free',
          status:   profile?.subscription_status ?? 'inactive',
          expiresAt: profile?.subscription_expires_at ?? null,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── RESTORE ───────────────────────────────────────────────────────────────
    if (action === 'restore') {
      try {
        const subscriber = await fetchRCSubscriber(user.id);
        const { isPro, isTrial, plan, expiresAt } = parseRCSubscriberStatus(subscriber);
        const status = isPro ? (isTrial ? 'trial' : 'active') : 'inactive';

        await supabaseAdmin.from('user_profiles').update({
          subscription_plan:       plan,
          subscription_status:     status,
          subscription_expires_at: expiresAt,
        }).eq('id', user.id);

        return new Response(JSON.stringify({ success: true, isPro, isTrial, plan, status, expiresAt }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (rcErr: any) {
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('subscription_plan, subscription_status, subscription_expires_at, trial_start_at')
          .eq('id', user.id)
          .single();

        return new Response(JSON.stringify({ success: true, profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── UNLOCK_EVENT — consumable one-off purchase that unlocks a single
    // event (see purchaseEventPass in contexts/PlanContext.tsx). Never
    // trusts the client's customerInfoJson for the actual grant — always
    // re-checks against RevenueCat's own REST API, same discipline as
    // rc_validate above.
    if (action === 'unlock_event') {
      const eventId = body.eventId;
      if (!eventId || typeof eventId !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'eventId is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: eventRow } = await supabaseAdmin
        .from('events')
        .select('id, unlock_source')
        .eq('id', eventId)
        .eq('user_id', user.id)
        .single();

      if (!eventRow) {
        return new Response(JSON.stringify({ success: false, error: 'Event not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (eventRow.unlock_source) {
        // Already unlocked (free first event or an earlier purchase) —
        // nothing to do, and nothing was charged twice.
        return new Response(JSON.stringify({ success: true, alreadyUnlocked: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Repeat-refund accounts lose access to one-off purchases (they can
      // still subscribe) — checked before touching RC at all.
      const { data: profileRow } = await supabaseAdmin
        .from('user_profiles')
        .select('refund_count')
        .eq('id', user.id)
        .single();

      if ((profileRow?.refund_count ?? 0) >= 2) {
        return new Response(JSON.stringify({
          success: false,
          error: 'refund_limit_reached',
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        const subscriber = await fetchRCSubscriber(user.id);
        const nonSubscriptions = subscriber?.subscriber?.non_subscriptions ?? {};
        const eventPassPurchases: any[] = nonSubscriptions['com.ironman.spinshot.app.event.pass'] ?? [];

        // Which specific RC transactions has this account already spent on
        // some event? (Kept on the event row even after a refund revokes
        // unlock_source — see protect_event_entitlement_columns — so a
        // refunded transaction can never be matched as "available" again.)
        const { data: consumedRows } = await supabaseAdmin
          .from('events')
          .select('purchase_transaction_id')
          .eq('user_id', user.id)
          .not('purchase_transaction_id', 'is', null);

        const consumedIds = new Set((consumedRows ?? []).map((r: any) => r.purchase_transaction_id));

        // NOTE: assumes each entry in non_subscriptions has a stable unique
        // `id` field — confirmed by inspecting a real RC subscriber
        // response before relying on this in production.
        const availablePurchase = eventPassPurchases.find((p: any) => p?.id && !consumedIds.has(p.id));

        if (!availablePurchase) {
          console.warn(`[validate-purchase] unlock_event: no unused pass. total=${eventPassPurchases.length} consumed=${consumedIds.size} sample=${JSON.stringify(eventPassPurchases[0] ?? null)}`);
          return new Response(JSON.stringify({ success: false, error: 'No unused event pass found for this account.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: updateError } = await supabaseAdmin
          .from('events')
          .update({
            unlock_source: 'purchase',
            unlocked_at: new Date().toISOString(),
            purchase_transaction_id: availablePurchase.id,
          })
          .eq('id', eventId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        await supabaseAdmin.from('subscription_events').insert({
          user_id:    user.id,
          event_type: 'event_pass_unlocked',
          plan:       null,
          platform:   body.platform ?? 'unknown',
        });

        console.log(`[validate-purchase] unlock_event user=${user.id} event=${eventId} tx=${availablePurchase.id}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (rcErr: any) {
        console.error('[validate-purchase] unlock_event RC error:', rcErr.message);
        return new Response(JSON.stringify({ success: false, error: rcErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── ACTIVATE — disabled. There is no IAP free trial anymore (removed in
    // favor of per-event unlocks: the first event a new account creates is
    // free, and later events need either an active subscription or a
    // one-off event-pass purchase — see 20260804142000_event_entitlement.sql
    // and the unlock_event action above.
    // This action used to grant a free trial/active subscription with zero
    // payment verification; since there's no legitimate free grant left to
    // hand out here and no real web payment processor is wired up, it's now
    // a hard no-op. Real paid subscriptions only ever come from the mobile
    // IAP flow (rc_validate/check, verified against the RevenueCat REST API)
    // or rc-webhook (signed RevenueCat server events).
    if (action === 'activate') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Web checkout is not available. Subscribe from the SpinShot mobile app.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      await supabaseAdmin
        .from('user_profiles')
        .update({ subscription_status: 'cancelled' })
        .eq('id', user.id);

      await supabaseAdmin.from('subscription_events').insert({
        user_id:    user.id,
        event_type: 'subscription_cancelled',
        plan:       null,
        platform:   null,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CHECK STATUS ──────────────────────────────────────────────────────────
    if (action === 'check') {
      // Always read the DB profile first
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('subscription_plan, subscription_status, subscription_expires_at, trial_start_at, refund_count')
        .eq('id', user.id)
        .single();

      // Helper: build response from DB profile
      const buildFromProfile = (p: any) => {
        let dbStatus = p?.subscription_status ?? 'inactive';
        const dbPlan  = p?.subscription_plan  ?? 'free';
        // Auto-expire if past expiry date
        if (p?.subscription_expires_at && new Date(p.subscription_expires_at) < new Date() && dbStatus === 'active') {
          dbStatus = 'expired';
        }
        const dbIsPro = (dbStatus === 'active' || dbStatus === 'trial') && dbPlan !== 'free';
        return { plan: dbPlan, status: dbStatus, isPro: dbIsPro, isTrial: dbStatus === 'trial', expiresAt: p?.subscription_expires_at ?? null, trialStartAt: p?.trial_start_at ?? null, refundCount: p?.refund_count ?? 0 };
      };

      try {
        const subscriber = await fetchRCSubscriber(user.id);
        const { isPro: rcIsPro, isTrial, plan: rcPlan, expiresAt } = parseRCSubscriberStatus(subscriber);
        const rcStatus = rcIsPro ? (isTrial ? 'trial' : 'active') : 'inactive';

        // If RC says the user is NOT pro but the DB says they ARE (e.g. activated via web/fallback
        // or by a recent purchase not yet reflected in RC), trust the DB until it expires.
        if (!rcIsPro && profile) {
          const dbResult = buildFromProfile(profile);
          if (dbResult.isPro) {
            console.log(`[validate-purchase] check: RC says free but DB says pro — trusting DB for user=${user.id}`);
            return new Response(JSON.stringify(dbResult), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // RC has an active subscription — sync to DB
        if (profile && (profile.subscription_plan !== rcPlan || profile.subscription_status !== rcStatus)) {
          await supabaseAdmin.from('user_profiles').update({
            subscription_plan:       rcPlan,
            subscription_status:     rcStatus,
            subscription_expires_at: expiresAt,
          }).eq('id', user.id);
        }

        const trialStartAt = profile?.trial_start_at ?? null;

        return new Response(JSON.stringify({
          plan: rcPlan, status: rcStatus, isPro: rcIsPro, isTrial,
          expiresAt,
          trialStartAt,
          refundCount: profile?.refund_count ?? 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (rcErr: any) {
        console.warn('[validate-purchase] check: RC fallback:', rcErr.message);
        // profile was already read above — use it directly
        if (!profile) {
          return new Response(JSON.stringify({ plan: 'free', status: 'inactive', isPro: false, isTrial: false, expiresAt: null, trialStartAt: null, refundCount: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(buildFromProfile(profile)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[validate-purchase] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
