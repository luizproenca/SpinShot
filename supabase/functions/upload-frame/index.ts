import { corsHeaders } from '../_shared/cors.ts';

const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '';
const API_KEY = Deno.env.get('CLOUDINARY_API_KEY') ?? '';
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { frameUrl, userId, name } = await req.json();

    if (!frameUrl || !userId) {
      return new Response(
        JSON.stringify({ error: 'frameUrl and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Cloudinary credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const folder = `spinshot_frames/${userId}`;
    const publicId = `frame_${Date.now()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));

    const signParams = {
      folder,
      public_id: publicId,
      timestamp,
    };
    const signature = await buildSignature(signParams);

    const formData = new FormData();
    formData.append('file', frameUrl);
    formData.append('api_key', API_KEY);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('resource_type', 'image');

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Cloudinary upload failed: ${errText}`);
    }

    const uploadData = await uploadRes.json();
    const cloudinaryPublicId = uploadData.public_id as string;

    const thumbnailUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_400,h_711,c_fill/${cloudinaryPublicId}.png`;

    console.log('Frame uploaded:', cloudinaryPublicId);

    return new Response(
      JSON.stringify({
        publicId: cloudinaryPublicId,
        thumbnailUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('upload-frame error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
