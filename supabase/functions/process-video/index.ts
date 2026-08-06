import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '';
const API_KEY = Deno.env.get('CLOUDINARY_API_KEY') ?? '';
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

type VideoEffect = 'boomerang' | 'cinematic' | 'hype';

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildSignature(params: Record<string, string>): Promise<string> {
  const sortedStr = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sha1Hex(`${sortedStr}${API_SECRET}`);
}

function isVideoEffect(value: unknown): value is VideoEffect {
  return value === 'boomerang' || value === 'cinematic' || value === 'hype';
}

function buildWatermarkTransformation(): string {
  return 'l_text:Arial_30_bold:Powered%20by%20SpinShot%20360,co_white,o_55,g_center';
}

function buildAudioLayer(musicPublicId: string, audioDuration: number): string {
  const layerRef = musicPublicId.replace(/\//g, ':');
  const safeDuration = Math.max(1, Math.ceil(audioDuration));
  return `ac_none/l_audio:${layerRef}/du_${safeDuration}/fl_layer_apply`;
}

function buildFrameOverlay(framePublicId: string): string {
  const layerRef = framePublicId.replace(/\//g, ':');
  return `l_${layerRef},w_1.0,h_1.0,fl_relative/fl_layer_apply`;
}

function getEffectDurationMultiplier(effect: VideoEffect): number {
  switch (effect) {
    case 'cinematic':
      return 2.3;
    case 'hype':
      return 1.6;
    case 'boomerang':
    default:
      return 2;
  }
}

function buildBoomerangEffect(): string {
  return 'e_boomerang';
}

function buildCinematicEffect(publicId: string, duration: number): string {
  const layerRef = publicId.replace(/\//g, ':');
  const total = Math.max(2, duration);

  const slowSource = total * 0.15;
  const easeZone = slowSource * 0.3;
  const normalEnd = total - slowSource;

  const s1 = Number(normalEnd.toFixed(2));
  const s2 = Number((normalEnd + easeZone).toFixed(2));
  const s3 = Number((normalEnd + slowSource - easeZone).toFixed(2));
  const s4 = Number((normalEnd + slowSource).toFixed(2));

  const base = `so_0,eo_${s1}`;
  const easeIn = `l_video:${layerRef},so_${s1},eo_${s2}/e_accelerate:-20/fl_splice`;
  const slow = `l_video:${layerRef},so_${s2},eo_${s3}/e_accelerate:-50/fl_splice`;
  const easeOut = `l_video:${layerRef},so_${s3},eo_${s4}/e_accelerate:-20/fl_splice`;
  const reverseSlow = `l_video:${layerRef},so_${s1},eo_${s4}/e_reverse/e_accelerate:-50/fl_splice`;
  const reverseNormal = `l_video:${layerRef},so_0,eo_${s1}/e_reverse/fl_splice`;

  return `${base}/${easeIn}/${slow}/${easeOut}/${reverseSlow}/${reverseNormal}`;
}

function buildHypeEffect(publicId: string, duration: number): string {
  const layerRef = publicId.replace(/\//g, ':');
  const total = Math.max(2, duration);

  const mid = total * 0.5;
  const spike = total * 0.1;

  const s1 = Number((mid - spike).toFixed(2));
  const s2 = Number((mid + spike).toFixed(2));

  const base = `so_0,eo_${s1}`;
  const speedUp = `l_video:${layerRef},so_${s1},eo_${s2}/e_accelerate:80/fl_splice`;
  const reverseFast = `l_video:${layerRef},so_${s1},eo_${s2}/e_reverse/e_accelerate:80/fl_splice`;
  const reverseNormal = `l_video:${layerRef},so_0,eo_${s1}/e_reverse/fl_splice`;

  return `${base}/${speedUp}/${reverseFast}/${reverseNormal}`;
}

function buildVideoTransformation(
  effect: VideoEffect,
  videoPublicId: string,
  duration: number,
): string {
  switch (effect) {
    case 'cinematic':
      return buildCinematicEffect(videoPublicId, duration);
    case 'hype':
      return buildHypeEffect(videoPublicId, duration);
    case 'boomerang':
    default:
      return buildBoomerangEffect();
  }
}

async function uploadRemoteVideoToCloudinary(
  videoUrl: string,
  folder: string,
  publicId: string,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));

  const signParams = {
    folder,
    public_id: publicId,
    timestamp,
  };

  const signature = await buildSignature(signParams);

  const formData = new FormData();
  formData.append('file', videoUrl);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);
  formData.append('public_id', publicId);
  formData.append('resource_type', 'video');

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
    { method: 'POST', body: formData },
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  return await uploadRes.json();
}

async function deleteCloudinaryVideo(publicId: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));

  const signParams = {
    public_id: publicId,
    timestamp,
  };

  const signature = await buildSignature(signParams);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('resource_type', 'video');

  const deleteRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/destroy`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!deleteRes.ok) {
    const errText = await deleteRes.text();
    throw new Error(`Cloudinary delete failed: ${errText}`);
  }

  return await deleteRes.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: every caller must hold a valid Supabase session ─────────────
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
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // isPro is resolved server-side from the authenticated user's own profile —
    // never trust a client-supplied `isPro` flag (that used to let anyone get
    // the HD/no-watermark render for free by just sending isPro: true).
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_plan, subscription_status, subscription_expires_at, trusted_purchaser_at')
      .eq('id', user.id)
      .single();

    const notExpired = !profile?.subscription_expires_at
      || new Date(profile.subscription_expires_at) > new Date();
    const hasRealSubscription = !!profile
      && profile.subscription_plan !== 'free'
      && (profile.subscription_status === 'active' || profile.subscription_status === 'trial')
      && notExpired;

    const {
      videoUrl,
      eventId,
      musicCloudinaryId,
      frameCloudinaryId,
      finalDuration,
      audioDuration,
      effect,
    } = await req.json();

    // Per-event entitlement — the first event a new account creates is free
    // ('free_first_event'), or an event can be unlocked with a one-off
    // "event pass" purchase ('purchase'). Either way, the unlock only
    // applies while today falls within a window around the event's own
    // (immutable) real-world date — anchored to event_date, not to when
    // the pass was bought or the account was created, so a pass bought
    // ahead of time doesn't expire before the event happens, and the same
    // event can't be silently reused for an unrelated later event.
    let eventUnlockSource: 'purchase' | 'free_first_event' | null = null;
    if (eventId) {
      const { data: eventRow } = await supabaseAdmin
        .from('events')
        .select('event_date, unlock_source')
        .eq('id', eventId)
        .eq('user_id', user.id)
        .single();

      if (eventRow?.unlock_source === 'free_first_event') {
        // No purchase involved — nothing to protect against reuse for, so
        // the "your first event is free" promise holds regardless of when
        // the account owner actually gets around to recording it.
        eventUnlockSource = 'free_first_event';
      } else if (eventRow?.unlock_source === 'purchase' && eventRow.event_date) {
        const eventDateMs = new Date(eventRow.event_date).getTime();
        const DAY_MS = 24 * 60 * 60 * 1000;
        const windowStart = eventDateMs - DAY_MS;
        const windowEnd = eventDateMs + 2 * DAY_MS;
        if (Date.now() >= windowStart && Date.now() <= windowEnd) {
          eventUnlockSource = 'purchase';
        }
      }
    }

    const isPro = hasRealSubscription || eventUnlockSource !== null;

    // Anti-refund hold: any access backed by a real charge (one-off pass
    // OR subscription) gets a watermarked/clean split until
    // reconcile-clean-video confirms, after the hold window, that no
    // refund landed — see 20260805160000_clean_reveal_confirmation.sql.
    // The free first event never had a payment tied to it, so it's
    // exempt. A previously-trusted account (one full cycle already
    // survived unrefunded) skips the hold entirely going forward.
    const trustedPurchaser = !!profile?.trusted_purchaser_at;
    const paidAccess = eventUnlockSource === 'purchase' || hasRealSubscription;
    const needsWatermarkSplit = paidAccess && !trustedPurchaser;
    const holdReason: 'purchase' | 'subscription' | null = !needsWatermarkSplit
      ? null
      : eventUnlockSource === 'purchase' ? 'purchase' : 'subscription';



    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'videoUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Cloudinary credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const resolvedEffect: VideoEffect = isVideoEffect(effect) ? effect : 'boomerang';
    const videoQuality =
      isPro === true ? 'q_auto:best,w_1080' : 'q_auto:good,w_480';

    // 1) Upload original video
    const folder = `spinshot/${user.id}`;
    const publicId = `video_${Date.now()}`;

    console.log('Uploading raw video...');
    const uploadData = await uploadRemoteVideoToCloudinary(
      videoUrl,
      folder,
      publicId,
    );

    const uploadedPublicId = uploadData.public_id as string;
    const uploadedDuration = Number(uploadData.duration ?? 0);

    console.log('Upload OK:', uploadedPublicId, '| effect:', resolvedEffect);

    // 2) Build effect-only video
    const videoTransformation = buildVideoTransformation(
      resolvedEffect,
      uploadedPublicId,
      uploadedDuration,
    );

    
    const effectUrl =
      `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/` +
      `ac_none/` +
      `${videoTransformation}` +
      `/${videoQuality}/f_mp4/${uploadedPublicId}.mp4`;

    console.log('Effect URL:', effectUrl);

    // 3) Materialize effect video
    const derivedUpload = await uploadRemoteVideoToCloudinary(
      effectUrl,
      folder,
      `${publicId}_fx`,
    );

    const effectPublicId = derivedUpload.public_id as string;

    console.log('Effect materialized:', effectPublicId);

    // 4) Resolve durations and layers
    const multiplier = getEffectDurationMultiplier(resolvedEffect);

    const resolvedAudioDuration =
      typeof audioDuration === 'number' && audioDuration > 0
        ? audioDuration
        : typeof finalDuration === 'number' && finalDuration > 0
        ? finalDuration
        : uploadedDuration > 0
        ? Math.ceil(uploadedDuration * multiplier)
        : 10;

    const audio = musicCloudinaryId
      ? `/${buildAudioLayer(String(musicCloudinaryId).trim(), resolvedAudioDuration)}`
      : '/ac_none';
      
    const frameOverlay = frameCloudinaryId
      ? `/${buildFrameOverlay(String(frameCloudinaryId).trim())}`
      : '';

    const watermark =
      !(isPro === true) ? `/${buildWatermarkTransformation()}` : '';

    // 5) Final video = effect materialized + audio + frame + watermark
    const processedUrl =
      `https://res.cloudinary.com/${CLOUD_NAME}/video/upload` +
      `${audio}` +
      `${frameOverlay}` +
      `${watermark}` +
      `/${videoQuality}/f_mp4/${effectPublicId}.mp4`;

    // Anti-refund: for events unlocked via a paid one-off pass, also build
    // a watermarked variant from the same materialized asset (no extra
    // Cloudinary render — it's just a different transformation string) so
    // the client can show/deliver that one immediately and hold back the
    // clean `processedUrl` until `cleanAvailableAt` has passed.
    let watermarkedUrl: string | null = null;
    let cleanAvailableAt: string | null = null;
    if (needsWatermarkSplit) {
      watermarkedUrl =
        `https://res.cloudinary.com/${CLOUD_NAME}/video/upload` +
        `${audio}` +
        `${frameOverlay}` +
        `/${buildWatermarkTransformation()}` +
        `/${videoQuality}/f_mp4/${effectPublicId}.mp4`;
      cleanAvailableAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    }

    // 6) Thumbnail from materialized effect video
    const thumbnailUrl =
      `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/` +
      `w_640,h_480,c_fill,so_1/f_jpg/${effectPublicId}.jpg`;

    // 7) Delete original upload after final asset is ready
    /*try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const deleteResult = await deleteCloudinaryVideo(uploadedPublicId);
      console.log('Original deleted:', uploadedPublicId, deleteResult);
    } catch (deleteErr) {
      console.warn('Failed to delete original video:', deleteErr);
    } */

    return new Response(
      JSON.stringify({
        processedUrl,
        thumbnailUrl,
        publicId: effectPublicId,
        hasMusic: Boolean(musicCloudinaryId),
        hasFrame: Boolean(frameCloudinaryId),
        effect: resolvedEffect,
        watermarkedUrl,
        cleanAvailableAt,
        holdReason,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('process-video error:', err);

    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});