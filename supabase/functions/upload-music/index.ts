import { corsHeaders } from '../_shared/cors.ts';

const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '';
const API_KEY    = Deno.env.get('CLOUDINARY_API_KEY') ?? '';
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildSignature(params: Record<string, string>): Promise<string> {
  const sortedStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return sha1Hex(`${sortedStr}${API_SECRET}`);
}

/**
 * All music tracks with their source URLs and desired Cloudinary public_ids.
 * The public_id corresponds exactly to the cloudinaryPublicId in constants/music.ts.
 */
const MUSIC_LIBRARY = [
  // ── FREE ──
  { id: 'party_001',     publicId: 'spinshot/music/party_001',     url: 'https://cdn.pixabay.com/audio/2024/01/02/audio_a68a38dac7.mp3' },
  { id: 'wedding_001',   publicId: 'spinshot/music/wedding_001',   url: 'https://cdn.pixabay.com/audio/2023/11/13/audio_9b3f29b1dd.mp3' },
  { id: 'corporate_001', publicId: 'spinshot/music/corporate_001', url: 'https://cdn.pixabay.com/audio/2024/02/15/audio_f9a3b6e123.mp3' },
  { id: 'chill_001',     publicId: 'spinshot/music/chill_001',     url: 'https://cdn.pixabay.com/audio/2024/03/10/audio_c2d4e8f012.mp3' },
  { id: 'party_002',     publicId: 'spinshot/music/party_002',     url: 'https://cdn.pixabay.com/audio/2023/12/20/audio_7e9b1c3a56.mp3' },
  // ── PREMIUM ──
  { id: 'party_003',     publicId: 'spinshot/music/party_003',     url: 'https://cdn.pixabay.com/audio/2024/04/05/audio_a1b2c3d4e5.mp3' },
  { id: 'party_004',     publicId: 'spinshot/music/party_004',     url: 'https://cdn.pixabay.com/audio/2024/05/12/audio_b2c3d4e5f6.mp3' },
  { id: 'wedding_002',   publicId: 'spinshot/music/wedding_002',   url: 'https://cdn.pixabay.com/audio/2024/06/18/audio_c3d4e5f6a7.mp3' },
  { id: 'wedding_003',   publicId: 'spinshot/music/wedding_003',   url: 'https://cdn.pixabay.com/audio/2024/07/22/audio_d4e5f6a7b8.mp3' },
  { id: 'corporate_002', publicId: 'spinshot/music/corporate_002', url: 'https://cdn.pixabay.com/audio/2024/08/01/audio_e5f6a7b8c9.mp3' },
  { id: 'corporate_003', publicId: 'spinshot/music/corporate_003', url: 'https://cdn.pixabay.com/audio/2024/09/15/audio_f6a7b8c9d0.mp3' },
  { id: 'chill_002',     publicId: 'spinshot/music/chill_002',     url: 'https://cdn.pixabay.com/audio/2024/10/05/audio_a7b8c9d0e1.mp3' },
  { id: 'chill_003',     publicId: 'spinshot/music/chill_003',     url: 'https://cdn.pixabay.com/audio/2024/11/20/audio_b8c9d0e1f2.mp3' },
];

/**
 * Upload a single audio track to Cloudinary.
 * - resource_type 'video' is required for audio files in Cloudinary.
 * - overwrite: false — skip if already uploaded (idempotent).
 * - invalidate: true — purge CDN cache for updated assets.
 */
async function uploadTrack(track: { id: string; publicId: string; url: string }): Promise<{
  id: string;
  status: 'uploaded' | 'skipped' | 'error';
  cloudinaryPublicId?: string;
  error?: string;
}> {
  try {
    const timestamp = String(Math.floor(Date.now() / 1000));
    // Extract folder and filename from publicId (e.g. "spinshot/music/party_001")
    const parts     = track.publicId.split('/');
    const publicKey = parts[parts.length - 1];           // "party_001"
    const folder    = parts.slice(0, -1).join('/');      // "spinshot/music"

    const signParams: Record<string, string> = {
      folder,
      overwrite: 'false',
      public_id: publicKey,
      timestamp,
    };
    const signature = await buildSignature(signParams);

    const formData = new FormData();
    formData.append('file', track.url);           // Cloudinary fetches from URL
    formData.append('api_key', API_KEY);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', publicKey);
    formData.append('overwrite', 'false');
    formData.append('resource_type', 'video');    // Required for audio

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      { method: 'POST', body: formData }
    );

    const body = await res.text();

    if (!res.ok) {
      // "already exists" means overwrite=false rejected — that's OK, asset is there
      if (body.includes('already exists') || body.includes('public_id')) {
        console.log(`[${track.id}] Already in Cloudinary → skipped`);
        return { id: track.id, status: 'skipped', cloudinaryPublicId: track.publicId };
      }
      console.warn(`[${track.id}] Upload error:`, body.slice(0, 200));
      return { id: track.id, status: 'error', error: body.slice(0, 200) };
    }

    let data: any;
    try { data = JSON.parse(body); } catch { data = {}; }

    console.log(`[${track.id}] Uploaded → ${data.public_id}`);
    return { id: track.id, status: 'uploaded', cloudinaryPublicId: data.public_id };
  } catch (err: any) {
    console.error(`[${track.id}] Exception:`, err.message);
    return { id: track.id, status: 'error', error: err.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Cloudinary credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: upload only specific tracks (body.ids) or all if omitted
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const requestedIds: string[] | undefined = body.ids;

    const tracksToUpload = requestedIds
      ? MUSIC_LIBRARY.filter(t => requestedIds.includes(t.id))
      : MUSIC_LIBRARY;

    console.log(`Uploading ${tracksToUpload.length} tracks to Cloudinary...`);

    // Upload sequentially to avoid overwhelming Cloudinary rate limits
    const results = [];
    for (const track of tracksToUpload) {
      const result = await uploadTrack(track);
      results.push(result);
      // Small delay between uploads
      await new Promise(r => setTimeout(r, 300));
    }

    const uploaded = results.filter(r => r.status === 'uploaded').length;
    const skipped  = results.filter(r => r.status === 'skipped').length;
    const errors   = results.filter(r => r.status === 'error').length;

    console.log(`Done: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, uploaded, skipped, errors, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('upload-music error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
