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

    // ── ACTIVATE — fallback for web / testing ─────────────────────────────────
    if (action === 'activate') {
      const { productId, purchaseToken, platform } = body;

      if (!productId) {
        return new Response(JSON.stringify({ error: 'productId required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const planMap: Record<string, string> = {
        'spinshot_pro_monthly': 'pro_monthly',
        'spinshot_pro_annual':  'pro_annual',
      };
      const plan = planMap[productId];
      if (!plan) {
        return new Response(JSON.stringify({ error: 'Unknown product' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = new Date();
      let expiresAt: Date;
      if (plan === 'pro_monthly') {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      }

      const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('trial_start_at')
        .eq('id', user.id)
        .single();

      const isFirstTime = !existingProfile?.trial_start_at;
      const isTrial = plan === 'pro_annual' && isFirstTime;

      const updateData: Record<string, any> = {
        subscription_plan:       plan,
        subscription_status:     isTrial ? 'trial' : 'active',
        subscription_expires_at: expiresAt.toISOString(),
        purchase_token:          purchaseToken || null,
        store_platform:          platform || 'unknown',
      };

      if (isTrial) {
        updateData.trial_start_at = now.toISOString();
        updateData.subscription_expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      await supabaseAdmin.from('subscription_events').insert({
        user_id:        user.id,
        event_type:     isTrial ? 'trial_started' : 'subscription_activated',
        plan,
        platform:       platform || 'unknown',
        purchase_token: purchaseToken || null,
      });

      return new Response(JSON.stringify({
        success:   true,
        plan,
        status:    isTrial ? 'trial' : 'active',
        expiresAt: expiresAt.toISOString(),
        isTrial,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        .select('subscription_plan, subscription_status, subscription_expires_at, trial_start_at')
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
        return { plan: dbPlan, status: dbStatus, isPro: dbIsPro, isTrial: dbStatus === 'trial', expiresAt: p?.subscription_expires_at ?? null, trialStartAt: p?.trial_start_at ?? null };
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
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (rcErr: any) {
        console.warn('[validate-purchase] check: RC fallback:', rcErr.message);
        // profile was already read above — use it directly
        if (!profile) {
          return new Response(JSON.stringify({ plan: 'free', status: 'inactive', isPro: false, isTrial: false, expiresAt: null, trialStartAt: null }), {
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
