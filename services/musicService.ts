/**
 * SpinShot 360 — Music Service
 *
 * Fetches music tracks from Supabase (source of truth).
 * Builds Cloudinary preview URLs on the fly from cloudinary_public_id.
 * No external CDN downloads, no Pixabay, no dynamic Cloudinary uploads.
 */

import { getSupabaseClient } from '@/template';
import { MusicTrack, MUSIC_AUTO_ID, MUSIC_NONE_ID, MusicSelection, PRESET_MUSIC_PRIORITY } from '../constants/music';


const supabase = getSupabaseClient();

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'spinshot360';

// ─── Build preview URL from Cloudinary public_id ──────────────────────────
export function buildCloudinaryPreviewUrl(cloudinaryPublicId: string): string {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${cloudinaryPublicId}.mp3`;
}

// ─── Map Supabase row to MusicTrack ──────────────────────────────────────
function rowToTrack(row: any): MusicTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist ?? 'SpinShot Beats',
    category: row.category,
    emoji: row.emoji ?? '🎵',
    cloudinaryPublicId: row.cloudinary_public_id,
    previewUrl: row.preview_url,
    duration: row.duration ?? 120,
    bpm: row.bpm ?? 120,
    isPremium: row.is_premium ?? false,
  };
}

// ─── Fetch all tracks from Supabase ──────────────────────────────────────
export async function fetchMusicTracks(): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('music_tracks')
    .select('*')
    .order('is_premium', { ascending: true })
    .order('category')
    .order('id');

  if (error) throw new Error('Erro ao carregar músicas: ' + error.message);
  return (data ?? []).map(rowToTrack);
}

// ─── Select best auto track based on effect + plan ───────────────────────
export function getAutoTrack(
  tracks: MusicTrack[],
  effect: string,
  isPro: boolean,
): MusicTrack | null {
  const priority = PRESET_MUSIC_PRIORITY[effect] ?? PRESET_MUSIC_PRIORITY['auto'];
  for (const id of priority) {
    const track = tracks.find(t => t.id === id);
    if (track && (isPro || !track.isPremium)) return track;
  }
  // Fallback: first free track
  return tracks.find(t => !t.isPremium) ?? tracks[0] ?? null;
}

// ─── Resolve which cloudinary_public_id to use for video processing ───────
export function resolveMusicForProcessing(
  tracks: MusicTrack[],
  musicSelection: MusicSelection | undefined,
  effect: string,
  isPro: boolean,
): string | null {
  if (!musicSelection || musicSelection === MUSIC_NONE_ID) return null;

  if (musicSelection === MUSIC_AUTO_ID) {
    const auto = getAutoTrack(tracks, effect, isPro);
    return auto?.cloudinaryPublicId ?? null;
  }

  const track = tracks.find(t => t.id === musicSelection);
  if (!track) return null;

  // Free users cannot use premium tracks — fallback to auto
  if (track.isPremium && !isPro) {
    const auto = getAutoTrack(tracks, effect, false);
    return auto?.cloudinaryPublicId ?? null;
  }

  return track.cloudinaryPublicId;
}
