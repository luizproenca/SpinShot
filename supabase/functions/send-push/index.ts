/**
 * SpinShot 360 — Send Push Notifications
 *
 * Internal/trusted-only function: fans a notification out to one or more
 * users' registered Expo push tokens, via Expo's push API (no APNs/FCM
 * secret needed — Expo brokers delivery using the project's EAS push
 * credentials).
 *
 * Not meant to be called directly by the app — only by other trusted
 * server-side triggers (e.g. a scheduled job for trial-ending reminders).
 * Requires INTERNAL_FUNCTION_SECRET as a Bearer token.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

    const body = await req.json();
    const userIds: string[] = Array.isArray(body.userIds)
      ? body.userIds
      : body.userId ? [body.userId] : [];
    const title: string = body.title ?? 'SpinShot 360';
    const message: string = body.body ?? '';
    const data: Record<string, unknown> = body.data ?? {};

    if (userIds.length === 0 || !message) {
      return new Response(JSON.stringify({ error: 'userIds (or userId) and body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: tokenRows, error: tokenError } = await supabaseAdmin
      .from('push_tokens')
      .select('id, token, user_id')
      .in('user_id', userIds);

    if (tokenError) throw tokenError;

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = tokenRows.map((row) => ({
      to: row.token,
      title,
      body: message,
      data,
      sound: 'default',
    }));

    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const pushJson = await pushRes.json().catch(() => null);

    // Prune tokens Expo reports as dead (app uninstalled, etc.) so the table
    // doesn't grow unbounded with tokens that will never deliver again.
    const tickets: any[] = Array.isArray(pushJson?.data) ? pushJson.data : [];
    const deadTokenIds: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        const row = tokenRows[i];
        if (row) deadTokenIds.push(row.id);
      }
    });

    if (deadTokenIds.length > 0) {
      await supabaseAdmin.from('push_tokens').delete().in('id', deadTokenIds);
    }

    return new Response(JSON.stringify({
      success: true,
      sent: messages.length,
      pruned: deadTokenIds.length,
      expoResponse: pushJson,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[send-push] error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
