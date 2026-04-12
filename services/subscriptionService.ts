/**
 * SpinShot 360 — Subscription Service
 * Handles IAP product metadata, plan enforcement, and purchase flow helpers.
 */

import { Platform } from 'react-native';
import type { IAPProductId } from '../contexts/PlanContext';

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
    const localeMap: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
    const locale = localeMap[lang] ?? 'pt-BR';
    return new Date(isoString).toLocaleDateString(locale, {
      day: '2-digit', month: 'long', year: 'numeric',
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

/**
 * Map productId → product details for display.
 */
export interface ProductDetails {
  id: IAPProductId;
  plan: 'pro_monthly' | 'pro_annual';
  priceLocal: string;
  priceIntl: string;
  period: string;
  hasTrial: boolean;
  trialDays: number;
  isBestValue: boolean;
}

export const PRODUCT_DETAILS: Record<IAPProductId, ProductDetails> = {
  spinshot_pro_monthly: {
    id: 'spinshot_pro_monthly',
    plan: 'pro_monthly',
    priceLocal: 'R$ 79,90',
    priceIntl: 'US$ 19.90',
    period: '/mês',
    hasTrial: false,
    trialDays: 0,
    isBestValue: false,
  },
  spinshot_pro_annual: {
    id: 'spinshot_pro_annual',
    plan: 'pro_annual',
    priceLocal: 'R$ 709,90',
    priceIntl: 'US$ 199.90',
    period: '/ano',
    hasTrial: true,
    trialDays: 30,
    isBestValue: true,
  },
};
