/**
 * SpinShot 360 — useMusic hook
 *
 * Loads music tracks from Supabase on mount.
 * Exposes free tracks, premium tracks and helpers.
 */

import { useState, useEffect, useCallback } from 'react';
import { MusicTrack } from '../constants/music';
import { fetchMusicTracks, getAutoTrack } from '../services/musicService';

export interface UseMusicResult {
  tracks: MusicTrack[];
  freeTracks: MusicTrack[];
  premiumTracks: MusicTrack[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  getAuto: (effect: string, isPro: boolean) => MusicTrack | null;
}

export function useMusic(): UseMusicResult {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMusicTracks();
      setTracks(data);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar músicas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const freeTracks = tracks.filter(t => !t.isPremium);
  const premiumTracks = tracks.filter(t => t.isPremium);

  const getAuto = useCallback(
    (effect: string, isPro: boolean) => getAutoTrack(tracks, effect, isPro),
    [tracks],
  );

  return { tracks, freeTracks, premiumTracks, loading, error, reload: load, getAuto };
}
