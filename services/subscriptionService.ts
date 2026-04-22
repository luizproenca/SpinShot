/**
 * SpinShot 360 — Subscription Service
 * Handles purchase helpers and subscription date formatting.
 */

import { Platform } from 'react-native';

export type PurchasePlatform = 'ios' | 'android' | 'web';

export function getCurrentPlatform(): PurchasePlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Format subscription expiry date for display.
 */
export function formatExpiryDate(isoString: string | null, lang: string = 'pt'): string {
  if (!isoString) return '';
  try {
    const localeMap: Record<string, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES',
    };
    const locale = localeMap[lang] ?? 'pt-BR';

    return new Date(isoString).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Get remaining trial days from trialStartAt (trial lasts 30 days).
 */
export function getTrialRemainingDays(trialStartAt: string | null): number {
  if (!trialStartAt) return 0;

  try {
    const startMs = new Date(trialStartAt).getTime();
    const trialEndMs = startMs + 30 * 24 * 60 * 60 * 1000;
    const remaining = Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  } catch {
    return 0;
  }
}