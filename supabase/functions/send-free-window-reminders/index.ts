/**
 * SpinShot 360 — Free-window-ending reminder
 *
 * Meant to run once a day (cron). Finds accounts whose 30-day "reverse
 * trial" free window (see FREE_WINDOW_DAYS in contexts/PlanContext.tsx and
 * supabase/functions/process-video/index.ts) ends in the next
 * REMINDER_DAYS_BEFORE_END days, haven't already subscribed, and haven't
 * already been reminded — then pushes a notification via Expo's push API
 * and marks them as reminded so this never double-sends.
 *
 * Requires INTERNAL_FUNCTION_SECRET as a Bearer token, same as send-push.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FREE_WINDOW_DAYS = 30; // keep in sync with contexts/PlanContext.tsx
const REMINDER_DAYS_BEFORE_END = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_TITLE = 'Seu mês grátis está acabando!';
const REMINDER_BODY = 'Faltam poucos dias para o fim do seu acesso completo no SpinShot 360. Assine para manter vídeos sem marca d\'água, HD e eventos ilimitados.';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const provided = authHeader.replace('Bearer ', '').trim();
    if (!internalSecret || provided !== internalSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = Date.now();
    const windowEndsAt = (createdAtMs: number) => createdAtMs + FREE_WINDOW_DAYS * DAY_MS;

    // created_at far enough back that the window ends within
    // REMINDER_DAYS_BEFORE_END days, but not already expired.
    const earliestCreatedAt = new Date(now - FREE_WINDOW_DAYS * DAY_MS).toISOString();
    const latestCreatedAt = new Date(now - (FREE_WINDOW_DAYS - REMINDER_DAYS_BEFORE_END) * DAY_MS).toISOString();

    const { data: candidates, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, created_at, subscription_plan, subscription_status, subscription_expires_at')
      .is('free_window_reminder_sent_at', null)
      .gte('created_at', earliestCreatedAt)
      .lte('created_at', latestCreatedAt);

    if (error) throw error;

    const now2 = new Date();
    const targets = (candidates ?? []).filter((p) => {
      const notExpired = !p.subscription_expires_at || new Date(p.subscription_expires_at) > now2;
      const hasRealSubscription = p.subscription_plan !== 'free'
        && (p.subscription_status === 'active' || p.subscription_status === 'trial')
        && notExpired;
      return !hasRealSubscription; // already-subscribed users don't need this nudge
    });

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetIds = targets.map((t) => t.id);

    const { data: tokenRows, error: tokenError } = await supabaseAdmin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', targetIds);

    if (tokenError) throw tokenError;

    let sent = 0;
    if (tokenRows && tokenRows.length > 0) {
      const messages = tokenRows.map((row) => ({
        to: row.token,
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        data: { type: 'free_window_ending' },
        sound: 'default',
      }));

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      sent = messages.length;
    }

    // Mark ALL targets as reminded, even ones with no push token registered,
    // so we don't keep re-querying them every day until the window closes.
    await supabaseAdmin
      .from('user_profiles')
      .update({ free_window_reminder_sent_at: new Date().toISOString() })
      .in('id', targetIds);

    return new Response(JSON.stringify({ success: true, candidates: targetIds.length, pushesSent: sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-free-window-reminders] error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
