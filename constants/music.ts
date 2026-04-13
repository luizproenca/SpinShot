/**
 * SpinShot 360 — Music Types & Constants
 *
 * Source of truth: Supabase table `music_tracks`
 * This file contains ONLY type definitions and constants.
 * No hardcoded track data — everything comes from the DB.
 */

export type MusicCategory = 'party' | 'wedding' | 'corporate' | 'chill';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  category: MusicCategory;
  emoji: string;
  /** Cloudinary public_id — e.g. "spinshot/music/party_001" */
  cloudinaryPublicId: string;
  /**
   * Preview URL built from Cloudinary.
   * Constructed at runtime: https://res.cloudinary.com/<cloud>/video/upload/<public_id>.mp3
   * Stored in DB as null — the app builds it via buildCloudinaryPreviewUrl()
   */
  previewUrl?: string;
  duration: number;
  bpm: number;
  isPremium: boolean;
}

// ─── Special option IDs ───────────────────────────────────────────────────
export const MUSIC_AUTO_ID = 'auto';
export const MUSIC_NONE_ID = 'none';

export type MusicSelection = string; // track id, 'auto', or 'none'

// ─── Category metadata ────────────────────────────────────────────────────
export const CATEGORY_META: Record<MusicCategory, {
  label_pt: string; label_en: string; label_es: string; emoji: string; color: string;
}> = {
  party:     { label_pt: 'Festa / Energia',      label_en: 'Party / Energy',    label_es: 'Fiesta / Energía',        emoji: '🎉', color: '#EC4899' },
  wedding:   { label_pt: 'Casamento / Emocional',label_en: 'Wedding / Emotional',label_es: 'Boda / Emocional',        emoji: '💍', color: '#F59E0B' },
  corporate: { label_pt: 'Elegante / Corporativo',label_en: 'Elegant / Corporate',label_es: 'Elegante / Corporativo', emoji: '💼', color: '#3B82F6' },
  chill:     { label_pt: 'Chill / Suave',        label_en: 'Chill / Smooth',    label_es: 'Chill / Suave',           emoji: '🌊', color: '#10B981' },
};

// ─── Auto-selection priority per effect ──────────────────────────────────
// Used by getAutoTrack() in musicService to pick the best free/pro track
export const PRESET_MUSIC_PRIORITY: Record<string, string[]> = {
  hype: ['party_001',   'corporate_001', 'party_002', 'corporate_002'],
  cinematic:  ['party_001',   'party_002', 'party_003', 'party_004'],
  boomerang:   ['party_001',   'party_002', 'chill_001', 'corporate_001'],
  auto:        ['party_001',   'chill_001', 'wedding_001', 'party_003'],
};
