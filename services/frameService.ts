import { getSupabaseClient } from '@/template';
import { VideoFrame } from './types';
import * as FileSystem from 'expo-file-system';

const supabase = getSupabaseClient();

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'spinshot360';

function buildThumbnailUrl(cloudinaryPublicId: string): string {
  if (!cloudinaryPublicId || cloudinaryPublicId.startsWith('user_frames/')) return '';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_400,h_711,c_fill/${cloudinaryPublicId}.png`;
}

function toFrame(row: any): VideoFrame {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    cloudinaryPublicId: row.cloudinary_public_id,
    // Use stored URL; fall back to building it from the public_id if missing
    thumbnailUrl: row.thumbnail_url || buildThumbnailUrl(row.cloudinary_public_id),
    isPremium: row.is_premium ?? false,
    isDefault: row.is_default ?? false,
    category: row.category,
    createdAt: row.created_at,
  };
}

async function uploadFrameToSupabaseStorage(userId: string, localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const fileName = `${userId}/${Date.now()}_frame.png`;

  const { error } = await supabase.storage
    .from('spinshot-frames')
    .upload(fileName, bytes.buffer as ArrayBuffer, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) throw new Error('Upload do arquivo falhou: ' + error.message);

  const { data } = supabase.storage.from('spinshot-frames').getPublicUrl(fileName);
  return data.publicUrl;
}

export const frameService = {
  /**
   * Fetch all frames visible to the user:
   * - All default frames (is_default = true)
   * - User's own personal frames
   */
  async getFrames(userId: string): Promise<VideoFrame[]> {
    const { data, error } = await supabase
      .from('video_frames')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(toFrame);
  },

  /**
   * Upload a custom PNG frame:
   * 1. Upload the raw PNG to Supabase Storage
   * 2. Upload it to Cloudinary via the upload-music edge function (reusing the upload pattern)
   * 3. Save metadata to video_frames table
   */
  async uploadCustomFrame(
    userId: string,
    localUri: string,
    name: string,
    onProgress?: (step: 'uploading' | 'saving') => void,
  ): Promise<VideoFrame> {
    onProgress?.('uploading');

    // Upload PNG to Supabase Storage to get a public URL
    const publicUrl = await uploadFrameToSupabaseStorage(userId, localUri);

    // Now upload to Cloudinary via direct API using the public URL
    const { data: fnData, error: fnError } = await supabase.functions.invoke('upload-frame', {
      body: { frameUrl: publicUrl, userId, name },
    });

    let cloudinaryPublicId = '';
    let thumbnailUrl = publicUrl; // fallback to storage URL

    if (!fnError && fnData?.publicId) {
      cloudinaryPublicId = fnData.publicId;
      thumbnailUrl = fnData.thumbnailUrl || publicUrl;
    } else {
      // Fallback: use storage URL as the public_id placeholder
      cloudinaryPublicId = `user_frames/${userId}/${Date.now()}`;
      thumbnailUrl = publicUrl;
    }

    onProgress?.('saving');

    const { data: row, error } = await supabase
      .from('video_frames')
      .insert({
        user_id: userId,
        name,
        cloudinary_public_id: cloudinaryPublicId,
        thumbnail_url: thumbnailUrl,
        is_premium: false,
        is_default: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toFrame(row);
  },

  async deleteFrame(userId: string, frameId: string): Promise<void> {
    const { error } = await supabase
      .from('video_frames')
      .delete()
      .eq('id', frameId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  /**
   * Build the Cloudinary thumbnail URL for a frame given its cloudinary_public_id.
   * Frames stored in Cloudinary are images (PNG with transparency).
   */
  buildFrameThumbnailUrl(cloudinaryPublicId: string): string {
    if (!cloudinaryPublicId || cloudinaryPublicId.startsWith('user_frames/')) {
      return '';
    }
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_400,h_711,c_fill/${cloudinaryPublicId}.png`;
  },

  /**
   * Build the overlay transformation string for Cloudinary video processing.
   * The frame PNG is applied as an overlay on top of the video.
   */
  buildFrameOverlayTransformation(cloudinaryPublicId: string): string {
    // Replace / with : for Cloudinary layer references
    const layerRef = cloudinaryPublicId.replace(/\//g, ':');
    // Apply PNG frame as overlay: full size, layer apply with fl_layer_apply
    return `l_${layerRef},w_1.0,h_1.0,fl_relative,fl_layer_apply`;
  },
};
