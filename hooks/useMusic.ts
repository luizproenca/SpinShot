/**
 * SpinShot 360 — useMusic hook
 *
 * Loads music tracks from Supabase on mount.
 * Exposes free tracks, premium tracks and helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

const MUSIC_LOAD_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Tempo limite excedido ao carregar músicas'));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function useMusic(): UseMusicResult {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await withTimeout(fetchMusicTracks(), MUSIC_LOAD_TIMEOUT_MS);

      if (!mountedRef.current) return;

      setTracks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (!mountedRef.current) return;

      setTracks([]);
      setError(e?.message ?? 'Erro ao carregar músicas');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const freeTracks = tracks.filter((t) => !t.isPremium);
  const premiumTracks = tracks.filter((t) => t.isPremium);

  const getAuto = useCallback(
    (effect: string, isPro: boolean) => getAutoTrack(tracks, effect, isPro),
    [tracks],
  );

  return {
    tracks,
    freeTracks,
    premiumTracks,
    loading,
    error,
    reload: () => {
      void load();
    },
    getAuto,
  };
}