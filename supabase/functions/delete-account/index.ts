import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Apple token revocation (Apple guideline 5.1.1(v)) ────────────────────────
// Deleting a Supabase user doesn't tell Apple anything — the account still
// looks "connected" from the user's Apple ID settings unless we explicitly
// revoke the token. Best-effort only: a failure here must never block the
// actual account deletion below.

const APPLE_TEAM_ID   = 'Q6943C4X4V';
const APPLE_BUNDLE_ID = 'com.ironman.spinshot.app';

function base64url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlJson(obj: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Builds the ES256 JWT Apple requires as `client_secret` for its token
// endpoints — this is NOT a static secret, it's signed per-request with the
// .p8 private key generated in Apple Developer > Keys.
async function buildAppleClientSecret(): Promise<string> {
  const privateKeyPem = Deno.env.get('APPLE_SIGNIN_PRIVATE_KEY') ?? '';
  const keyId = Deno.env.get('APPLE_SIGNIN_KEY_ID') ?? '';
  if (!privateKeyPem || !keyId) {
    throw new Error('APPLE_SIGNIN_PRIVATE_KEY / APPLE_SIGNIN_KEY_ID not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: 'ES256', kid: keyId });
  const payload = base64urlJson({
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: APPLE_BUNDLE_ID,
  });
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  // Web Crypto's ECDSA signature is already raw (r||s) — exactly the format
  // JWS ES256 expects, no DER-to-raw conversion needed.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

async function revokeAppleToken(authorizationCode: string): Promise<void> {
  const clientSecret = await buildAppleClientSecret();

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: APPLE_BUNDLE_ID,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Apple token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }

  const { refresh_token } = await tokenRes.json();
  if (!refresh_token) {
    throw new Error('Apple token exchange returned no refresh_token');
  }

  const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: APPLE_BUNDLE_ID,
      client_secret: clientSecret,
      token: refresh_token,
      token_type_hint: 'refresh_token',
    }),
  });

  if (!revokeRes.ok) {
    throw new Error(`Apple token revoke failed: ${revokeRes.status} ${await revokeRes.text()}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client — calls the SECURITY DEFINER function as the authenticated user
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Validate token first
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      console.error('[delete-account] invalid token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Best-effort — never blocks deletion. Only present for accounts that
    // just re-authenticated with Apple specifically to get a fresh code.
    let appleAuthorizationCode: string | null = null;
    try {
      const body = await req.json();
      appleAuthorizationCode = body?.appleAuthorizationCode ?? null;
    } catch {}

    if (appleAuthorizationCode) {
      try {
        await revokeAppleToken(appleAuthorizationCode);
        console.log('[delete-account] Apple token revoked for user:', user.id);
      } catch (e: any) {
        console.warn('[delete-account] Apple token revoke failed (non-blocking):', e.message);
      }
    }

    console.log('[delete-account] Deleting user via RPC:', user.id);

    // Call the SECURITY DEFINER SQL function — bypasses admin API restriction
    const { error: rpcError } = await supabaseUser.rpc('delete_own_account');

    if (rpcError) {
      console.error('[delete-account] RPC error:', rpcError.message);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[delete-account] Successfully deleted user:', user.id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[delete-account] Unexpected error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
