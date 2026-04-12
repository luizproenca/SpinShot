import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Video } from './types';
import { MOCK_QR_BASE_URL } from '../constants/config';
import { eventService } from './eventService';
import { MusicSelection, MUSIC_NONE_ID } from '../constants/music';
import { resolveMusicForProcessing } from './musicService';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDurationPlan, VideoPreset } from './videoEffectsService';

async function getStoredIsPro(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem('@spinshot:subscription_v2');
    if (stored) {
      const sub = JSON.parse(stored);
      return sub.isPro === true;
    }
    // Fallback to legacy key
    const plan = await AsyncStorage.getItem('@spinshot:plan');
    return plan === 'pro';
  } catch {
    return false;
  }
}

const supabase = getSupabaseClient();

function toVideo(row: any): Video {
  return {
    id: row.id,
    eventId: row.event_id || '',
    eventName: row.event_name,
    eventColor: row.event_color || '#8B5CF6',
    thumbnailUri: row.thumbnail_uri,
    videoUri: row.video_url,
    effect: row.effect || 'normal',
    duration: row.duration || 15,
    shareUrl: row.share_url || '',
    shareCode: row.share_code || '',
    createdAt: row.created_at,
    downloads: row.downloads || 0,
  };
}

async function uploadVideoToStorage(userId: string, localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const fileName = `${userId}/${Date.now()}_raw.mp4`;

  const { error } = await supabase.storage
    .from('spinshot-videos')
    .upload(fileName, bytes.buffer as ArrayBuffer, {
      contentType: 'video/mp4',
      upsert: false,
    });

  if (error) throw new Error('Upload falhou: ' + error.message);

  const { data: publicData } = supabase.storage
    .from('spinshot-videos')
    .getPublicUrl(fileName);

  return publicData.publicUrl;
}

async function processVideoWithEffects(
  storageUrl: string,
  effect: string,
  userId: string,
  musicCloudinaryId: string | null,
  frameCloudinaryId: string | null,
  isPro: boolean,
  finalDuration: number,
): Promise<{ processedUrl: string; thumbnailUrl: string }> {
  console.log('Music cloudinaryId resolved:', musicCloudinaryId ?? 'none');
  console.log('Frame cloudinaryId:', frameCloudinaryId ?? 'none');

  const preset = (effect || 'boomerang') as VideoPreset;
  const durationPlan = calculateDurationPlan(finalDuration, preset);

  const { data, error } = await supabase.functions.invoke('process-video', {
    body: {
      videoUrl: storageUrl,
      userId,
      isPro,
      musicCloudinaryId: musicCloudinaryId || undefined,
      frameCloudinaryId: frameCloudinaryId || undefined,
      sourceDuration: durationPlan.sourceDuration,
      finalDuration: durationPlan.finalDuration,
      audioDuration: durationPlan.audioDuration,
    },
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        errorMessage = `[Code: ${statusCode}] ${textContent || error.message}`;
      } catch {
        errorMessage = error.message || 'Edge Function error';
      }
    }
    throw new Error('process-video: ' + errorMessage);
  }

  return {
    processedUrl: data.processedUrl,
    thumbnailUrl: data.thumbnailUrl,
  };
}

export const videoService = {
  async getVideos(userId: string): Promise<Video[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(toVideo);
  },

  async saveVideo(
    userId: string,
    data: Partial<Video> & {
      videoUri?: string;
      musicSelection?: MusicSelection;
      musicTracks?: import('../constants/music').MusicTrack[];
      frameCloudinaryId?: string | null;
    },
    onProgress?: (step: 'uploading' | 'processing' | 'saving') => void,
  ): Promise<Video> {
    const shareCode = Math.random().toString(36).slice(2, 8);

    let finalVideoUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    if (data.videoUri && data.videoUri.startsWith('file://')) {
      try {
        onProgress?.('uploading');
        const storageUrl = await uploadVideoToStorage(userId, data.videoUri);

        onProgress?.('processing');
        const isPro = await getStoredIsPro();

        const musicCloudinaryId = resolveMusicForProcessing(
          data.musicTracks ?? [],
          data.musicSelection,
          data.effect || 'boomerang',
          isPro,
        );

      const processed = await processVideoWithEffects(
        storageUrl,
        data.effect || 'boomerang',
        userId,
        musicCloudinaryId,
        data.frameCloudinaryId || null,
        isPro,
        data.duration || 10,
      );
        finalVideoUrl = processed.processedUrl;
        thumbnailUrl = processed.thumbnailUrl;
      } catch (e) {
        console.error('Video upload/processing failed:', e);
      }
    }

    onProgress?.('saving');

    const shareUrl = `${MOCK_QR_BASE_URL}${shareCode}`;

    const { data: row, error } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        event_id: data.eventId || null,
        event_name: data.eventName || 'Evento',
        event_color: data.eventColor || '#8B5CF6',
        video_url: finalVideoUrl,
        thumbnail_uri: thumbnailUrl || data.thumbnailUri || null,
        effect: data.effect || 'normal',
        duration: data.duration || 15,
        share_url: finalVideoUrl || shareUrl,
        share_code: shareCode,
        downloads: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (data.eventId) {
      try { await eventService.incrementVideoCount(data.eventId); } catch {}
    }

    return toVideo(row);
  },

  async deleteVideo(userId: string, videoId: string): Promise<void> {
    const { data: video } = await supabase
      .from('videos')
      .select('video_url')
      .eq('id', videoId)
      .single();

    if (video?.video_url) {
      try {
        const url = new URL(video.video_url);
        const pathParts = url.pathname.split('/spinshot-videos/');
        if (pathParts[1]) {
          await supabase.storage.from('spinshot-videos').remove([pathParts[1]]);
        }
      } catch {}
    }

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },
};
