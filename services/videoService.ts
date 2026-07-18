import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Video } from './types';
import { eventService } from './eventService';
import { MusicSelection } from '../constants/music';
import { resolveMusicForProcessing } from './musicService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDurationPlan, VideoPreset } from './videoEffectsService';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';

async function getStoredIsPro(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem('@spinshot:subscription_v2');

    if (stored) {
      const sub = JSON.parse(stored);
      return sub.isPro === true;
    }

    const plan = await AsyncStorage.getItem('@spinshot:plan');
    return plan === 'pro';
  } catch {
    return false;
  }
}

const supabase = getSupabaseClient();
const STORAGE_BUCKET = 'spinshot-videos';

function toVideo(row: any): Video {
  return {
    id: row.id,
    eventId: row.event_id || '',
    eventName: row.event_name,
    eventColor: row.event_color || '#8B5CF6',
    thumbnailUri: row.thumbnail_uri || undefined,
    videoUri: row.video_url || undefined,
    effect: row.effect || 'normal',
    duration: row.duration || 15,
    shareUrl: row.share_url || row.video_url || '',
    shareCode: row.share_code || '',
    createdAt: row.created_at,
    downloads: row.downloads || 0,
  };
}

function getVideoContentType(localUri: string): string {
  const cleanUri = localUri.split('?')[0];
  const fileExt = cleanUri.split('.').pop()?.toLowerCase() || 'mp4';

  switch (fileExt) {
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'm4v':
      return 'video/x-m4v';
    case 'mp4':
    default:
      return 'video/mp4';
  }
}

function getVideoFileExtension(localUri: string): string {
  const cleanUri = localUri.split('?')[0];
  const fileExt = cleanUri.split('.').pop()?.toLowerCase();

  if (!fileExt || fileExt.length > 5 || fileExt.includes('/')) {
    return 'mp4';
  }

  return fileExt;
}

function isHttpUrl(value?: string | null): value is string {
  if (!value) return false;

  const lower = value.toLowerCase();
  return lower.startsWith('https://') || lower.startsWith('http://');
}

function isRemoteVideoUrl(value?: string | null): value is string {
  if (!value) return false;

  const lower = value.toLowerCase();

  if (!isHttpUrl(value)) return false;

  return (
    lower.includes('res.cloudinary.com') ||
    lower.includes('/video/upload/') ||
    lower.endsWith('.mp4') ||
    lower.includes('.mp4?')
  );
}

function normalizeLocalVideoUri(uri: string): string {
  if (!uri) return uri;

  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }

  return uri;
}

function isProcessableLocalVideoUri(uri?: string | null): uri is string {
  if (!uri) return false;

  const normalized = normalizeLocalVideoUri(uri);

  if (isHttpUrl(normalized)) {
    return false;
  }

  return (
    normalized.startsWith('file://') ||
    normalized.startsWith('content://') ||
    normalized.startsWith('ph://') ||
    normalized.startsWith('assets-library://') ||
    normalized.startsWith('/')
  );
}

function getStoragePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split(`/${STORAGE_BUCKET}/`);
    return pathParts[1] || null;
  } catch {
    return null;
  }
}

async function deleteLocalFile(localUri: string): Promise<void> {
  try {
    const normalized = normalizeLocalVideoUri(localUri);
    if (!normalized.startsWith('file://')) return;
    await FileSystem.deleteAsync(normalized, { idempotent: true });
  } catch (err) {
    console.warn('[videoService] failed to delete local temp video:', err);
  }
}

async function deleteStorageObject(fileName: string): Promise<void> {
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
  } catch (err) {
    console.warn('[videoService] failed to delete intermediate storage object:', err);
  }
}

async function uploadVideoToStorage(
  userId: string,
  localUri: string,
  signal?: AbortSignal,
): Promise<{ publicUrl: string; fileName: string }> {
  const normalizedUri = normalizeLocalVideoUri(localUri);
  const fileExt = getVideoFileExtension(normalizedUri);
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const contentType = getVideoContentType(normalizedUri);

  console.log('[uploadVideoToStorage] starting', {
    bucket: STORAGE_BUCKET,
    fileName,
    contentType,
    localUri: normalizedUri,
  });

  const fileResponse = await fetch(normalizedUri, { signal });

  if (!fileResponse.ok) {
    throw new Error(`Falha ao ler arquivo local: ${fileResponse.status}`);
  }

  const arrayBuffer = await fileResponse.arrayBuffer();

  if (!arrayBuffer.byteLength) {
    throw new Error('O arquivo local foi lido, mas está vazio.');
  }

  console.log('[uploadVideoToStorage] file loaded', {
    bytes: arrayBuffer.byteLength,
  });

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('[uploadVideoToStorage] upload failed', error);
    throw new Error(`Upload falhou: ${error.message || 'erro desconhecido no Supabase Storage'}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

  if (!data.publicUrl) {
    throw new Error('Upload concluído, mas a URL pública do vídeo não foi gerada.');
  }

  console.log('[uploadVideoToStorage] upload complete', {
    publicUrl: data.publicUrl,
  });

  return { publicUrl: data.publicUrl, fileName };
}

async function processVideoWithEffects(
  storageUrl: string,
  effect: string,
  userId: string,
  musicCloudinaryId: string | null,
  frameCloudinaryId: string | null,
  isPro: boolean,
  finalDuration: number,
): Promise<{ processedUrl: string; thumbnailUrl: string | null }> {
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

  const processedUrl = data?.processedUrl;
  const thumbnailUrl = data?.thumbnailUrl || null;

  if (!isRemoteVideoUrl(processedUrl)) {
    console.error('[processVideoWithEffects] invalid response', data);
    throw new Error('A Edge Function não retornou uma URL final válida do vídeo processado.');
  }

  return {
    processedUrl,
    thumbnailUrl,
  };
}

async function waitForRemoteVideoReady(url: string, signal?: AbortSignal): Promise<void> {
  const timeoutMs = 90000;
  const intervalMs = 2500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      throw new Error('Operação cancelada.');
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal,
      });

      if (response.ok || response.status === 405) {
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Operação cancelada.');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('O vídeo final foi gerado, mas ainda não ficou disponível para reprodução.');
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
    signal?: AbortSignal,
  ): Promise<Video> {
    if (!data.videoUri) {
      throw new Error('Nenhum vídeo foi informado para processamento.');
    }

    if (!isProcessableLocalVideoUri(data.videoUri)) {
      console.error('[saveVideo] invalid source video uri', {
        videoUri: data.videoUri,
      });

      throw new Error('O vídeo precisa ser uma URI local válida antes do processamento.');
    }

    const netState = await NetInfo.fetch();
    if (netState.isConnected === false || netState.isInternetReachable === false) {
      throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
    }

    const localSourceUri = normalizeLocalVideoUri(data.videoUri);
    const shareCode = Math.random().toString(36).slice(2, 8);

    onProgress?.('uploading');
    const { publicUrl: storageUrl, fileName: storageFileName } =
      await uploadVideoToStorage(userId, localSourceUri, signal);

    // The on-device recording has now been safely uploaded — it's never
    // read again after this point, so free up the device's storage.
    await deleteLocalFile(localSourceUri);

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

    await waitForRemoteVideoReady(processed.processedUrl, signal);

    // Cloudinary already fetched + materialized the final video — the
    // intermediate Supabase Storage copy was only needed to get it there.
    await deleteStorageObject(storageFileName);

    onProgress?.('saving');

    const { data: row, error } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        event_id: data.eventId || null,
        event_name: data.eventName || 'Evento',
        event_color: data.eventColor || '#8B5CF6',
        video_url: processed.processedUrl,
        thumbnail_uri: processed.thumbnailUrl,
        effect: data.effect || 'normal',
        duration: data.duration || 15,
        share_url: processed.processedUrl,
        share_code: shareCode,
        downloads: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (data.eventId) {
      try {
        await eventService.incrementVideoCount(data.eventId);
      } catch {}
    }

    return toVideo(row);
  },

  async deleteVideo(userId: string, videoId: string): Promise<void> {
    const { data: video } = await supabase
      .from('videos')
      .select('video_url')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (video?.video_url) {
      const storagePath = getStoragePathFromPublicUrl(video.video_url);
      if (storagePath) {
        await deleteStorageObject(storagePath);
      }
    }

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },
};