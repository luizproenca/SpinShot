/**
 * SpinShot 360 — RevenueCat Service (Native: iOS + Android)
 * Uses react-native-purchases SDK directly (no dynamic import — Metro handles
 * platform resolution via .native.ts extension, so this file is NEVER bundled
 * for web).
 */

import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RCPackage {
  identifier: string;
  productIdentifier: string;
  priceString: string;
  introPrice: string | null;
  offeringIdentifier: string;
  raw: any;
}

export interface RCCustomerInfo {
  activeSubscriptions: string[];
  entitlements: Record<string, { isActive: boolean; expirationDate: string | null; productIdentifier: string }>;
  latestExpirationDate: string | null;
  originalAppUserId: string;
  raw: any;
}

export interface PurchaseResult {
  success: boolean;
  customerInfo: RCCustomerInfo | null;
  isCancelled: boolean;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  customerInfo: RCCustomerInfo | null;
  error?: string;
}

export const RC_ENTITLEMENT_ID = 'pro';
export const RC_OFFERING_ID    = 'default';

export const RC_PRODUCT_IDS = {
  monthly: 'spinshot_pro_monthly',
  annual:  'spinshot_pro_annual',
} as const;

// ─── Lazy SDK loader (safe import inside .native.ts) ──────────────────────────

let _Purchases: any = null;
let _sdkReady = false;

function getSDK(): any | null {
  if (_sdkReady) return _Purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    _Purchases = mod.default ?? mod;
    _sdkReady = true;
    return _Purchases;
  } catch (e) {
    console.warn('[RC] react-native-purchases not available:', e);
    return null;
  }
}

// ─── Fetch SDK key from backend ───────────────────────────────────────────────

async function fetchRCPublicKey(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('validate-purchase', {
      body: { action: 'get_config', platform: Platform.OS },
    });
    if (error || !data?.key) {
      console.warn('[RC] Could not fetch public key:', error?.message);
      return '';
    }
    return data.key as string;
  } catch (e) {
    console.warn('[RC] fetchRCPublicKey error:', e);
    return '';
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let _initialised = false;
let _cachedApiKey = '';

export async function initRevenueCat(appUserId: string): Promise<void> {
  const Purchases = getSDK();
  if (!Purchases) return;

  try {
    if (!_cachedApiKey) {
      _cachedApiKey = await fetchRCPublicKey();
    }
    if (!_cachedApiKey) {
      console.warn('[RC] No public SDK key available.');
      return;
    }
    if (_initialised) {
      await Purchases.logIn(appUserId);
      return;
    }
    await Purchases.configure({ apiKey: _cachedApiKey, appUserID: appUserId });
    _initialised = true;
    console.log('[RC] Configured for user:', appUserId);
  } catch (e) {
    console.error('[RC] configure error:', e);
  }
}

export async function logOutRevenueCat(): Promise<void> {
  const Purchases = getSDK();
  if (!Purchases || !_initialised) return;
  try {
    await Purchases.logOut();
    _initialised = false;
  } catch (e) {
    console.warn('[RC] logOut error:', e);
  }
}

// ─── Offerings ────────────────────────────────────────────────────────────────

export async function getOfferings(): Promise<RCPackage[]> {
  const Purchases = getSDK();
  if (!Purchases || !_initialised) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current ?? offerings?.all?.[RC_OFFERING_ID];
    if (!current) return [];

    return (current.availablePackages ?? []).map((pkg: any): RCPackage => ({
      identifier:         pkg.identifier,
      productIdentifier:  pkg.product?.identifier ?? '',
      priceString:        pkg.product?.priceString ?? '',
      introPrice:         pkg.product?.introPrice?.priceString ?? null,
      offeringIdentifier: RC_OFFERING_ID,
      raw:                pkg,
    }));
  } catch (e) {
    console.warn('[RC] getOfferings error:', e);
    return [];
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function purchasePackage(pkg: RCPackage): Promise<PurchaseResult> {
  const Purchases = getSDK();
  if (!Purchases || !_initialised) {
    return { success: false, customerInfo: null, isCancelled: false, error: 'RevenueCat SDK not available' };
  }
  try {
    const result = await Purchases.purchasePackage(pkg.raw);
    return { success: true, customerInfo: mapCustomerInfo(result.customerInfo), isCancelled: false };
  } catch (e: any) {
    const isCancelled = e?.userCancelled === true || e?.code === 1;
    return {
      success: false, customerInfo: null, isCancelled,
      error: isCancelled ? 'cancelled' : (e?.message ?? 'Purchase failed'),
    };
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export async function restorePurchases(): Promise<RestoreResult> {
  const Purchases = getSDK();
  if (!Purchases || !_initialised) {
    return { success: false, customerInfo: null, error: 'RevenueCat SDK not available' };
  }
  try {
    const ci = await Purchases.restorePurchases();
    return { success: true, customerInfo: mapCustomerInfo(ci) };
  } catch (e: any) {
    return { success: false, customerInfo: null, error: e?.message ?? 'Restore failed' };
  }
}

// ─── Customer Info ────────────────────────────────────────────────────────────

export async function getCustomerInfo(): Promise<RCCustomerInfo | null> {
  const Purchases = getSDK();
  if (!Purchases || !_initialised) return null;
  try {
    const ci = await Purchases.getCustomerInfo();
    return mapCustomerInfo(ci);
  } catch {
    return null;
  }
}

export function isProActive(ci: RCCustomerInfo | null): boolean {
  if (!ci) return false;
  return ci.entitlements[RC_ENTITLEMENT_ID]?.isActive === true;
}

export function addCustomerInfoListener(
  listener: (ci: RCCustomerInfo) => void,
): () => void {
  const Purchases = getSDK();
  if (!Purchases) return () => {};
  try {
    Purchases.addCustomerInfoUpdateListener((rawCi: any) => {
      listener(mapCustomerInfo(rawCi));
    });
  } catch {}
  return () => {
    try { Purchases?.removeCustomerInfoUpdateListener(listener); } catch {}
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCustomerInfo(raw: any): RCCustomerInfo {
  const entitlements: RCCustomerInfo['entitlements'] = {};
  const rawEnts = raw?.entitlements?.active ?? raw?.entitlements ?? {};

  for (const [key, val] of Object.entries(rawEnts)) {
    const v = val as any;
    entitlements[key] = {
      isActive:          v.isActive ?? true,
      expirationDate:    v.expirationDate ?? null,
      productIdentifier: v.productIdentifier ?? '',
    };
  }

  return {
    activeSubscriptions:  raw?.activeSubscriptions ?? [],
    entitlements,
    latestExpirationDate: raw?.latestExpirationDate ?? null,
    originalAppUserId:    raw?.originalAppUserId ?? '',
    raw,
  };
}
