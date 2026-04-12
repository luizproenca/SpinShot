/**
 * SpinShot 360 — RevenueCat Service
 * Wraps the react-native-purchases SDK for real IAP on iOS and Android.
 * The public SDK key is fetched securely from the backend edge function.
 * On web or when SDK is unavailable, falls back gracefully.
 */

import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RCPackage {
  identifier: string;         // '$rc_monthly' | '$rc_annual'
  productIdentifier: string;  // 'spinshot_pro_monthly' | 'spinshot_pro_annual'
  priceString: string;        // localised price e.g. 'R$ 79,90'
  introPrice: string | null;  // e.g. 'R$ 0,00' during trial
  offeringIdentifier: string;
  raw: any;                   // raw Purchases.Package
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

// ─── Constants ────────────────────────────────────────────────────────────────

export const RC_ENTITLEMENT_ID = 'pro';
export const RC_OFFERING_ID    = 'default';

export const RC_PRODUCT_IDS = {
  monthly: 'spinshot_pro_monthly',
  annual:  'spinshot_pro_annual',
} as const;

// ─── SDK Loader (dynamic to prevent web crash) ────────────────────────────────

let _Purchases: any = null;
let _sdkReady = false;

async function getSDK(): Promise<any | null> {
  if (Platform.OS === 'web') return null;
  if (_sdkReady) return _Purchases;
  try {
    const mod = await import('react-native-purchases');
    _Purchases = mod.default ?? mod;
    _sdkReady = true;
    return _Purchases;
  } catch (e) {
    console.warn('[RC] react-native-purchases not available:', e);
    return null;
  }
}

// ─── Fetch SDK key from backend ───────────────────────────────────────────────

/**
 * Fetches the RevenueCat public SDK key from the edge function.
 * Keys are stored as backend secrets — never exposed client-side.
 */
async function fetchRCPublicKey(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('validate-purchase', {
      body: { action: 'get_config', platform: Platform.OS },
    });
    if (error || !data?.key) {
      console.warn('[RC] Could not fetch public key from backend:', error?.message);
      return '';
    }
    return data.key as string;
  } catch (e) {
    console.warn('[RC] fetchRCPublicKey error:', e);
    return '';
  }
}

// ─── Initialise ───────────────────────────────────────────────────────────────

let _initialised = false;
let _cachedApiKey = '';

/**
 * Call once after user logs in.
 * Fetches the public SDK key from the backend and configures RevenueCat.
 * @param appUserId  Supabase user id — used as RevenueCat App User ID
 */
export async function initRevenueCat(appUserId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const Purchases = await getSDK();
  if (!Purchases) return;

  try {
    // Fetch key server-side if not cached
    if (!_cachedApiKey) {
      _cachedApiKey = await fetchRCPublicKey();
    }

    if (!_cachedApiKey) {
      console.warn('[RC] No public SDK key available. Configure EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY in backend secrets.');
      return;
    }

    if (_initialised) {
      // Already configured — just log in the user
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

/**
 * Log out from RevenueCat (on sign-out).
 */
export async function logOutRevenueCat(): Promise<void> {
  if (Platform.OS === 'web') return;
  const Purchases = await getSDK();
  if (!Purchases || !_initialised) return;
  try {
    await Purchases.logOut();
    _initialised = false;
  } catch (e) {
    console.warn('[RC] logOut error:', e);
  }
}

// ─── Offerings & Packages ─────────────────────────────────────────────────────

/**
 * Fetch current offering packages from RevenueCat.
 * Returns empty array on web / if SDK unavailable.
 */
export async function getOfferings(): Promise<RCPackage[]> {
  const Purchases = await getSDK();
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

/**
 * Purchase a specific package.
 */
export async function purchasePackage(pkg: RCPackage): Promise<PurchaseResult> {
  const Purchases = await getSDK();
  if (!Purchases || !_initialised) {
    return { success: false, customerInfo: null, isCancelled: false, error: 'RevenueCat SDK not available' };
  }
  try {
    const result = await Purchases.purchasePackage(pkg.raw);
    const ci = mapCustomerInfo(result.customerInfo);
    return { success: true, customerInfo: ci, isCancelled: false };
  } catch (e: any) {
    const isCancelled = e?.userCancelled === true || e?.code === 1;
    return {
      success:      false,
      customerInfo: null,
      isCancelled,
      error: isCancelled ? 'cancelled' : (e?.message ?? 'Purchase failed'),
    };
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export async function restorePurchases(): Promise<RestoreResult> {
  const Purchases = await getSDK();
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
  const Purchases = await getSDK();
  if (!Purchases || !_initialised) return null;
  try {
    const ci = await Purchases.getCustomerInfo();
    return mapCustomerInfo(ci);
  } catch {
    return null;
  }
}

/**
 * Check if the user has an active 'pro' entitlement.
 */
export function isProActive(ci: RCCustomerInfo | null): boolean {
  if (!ci) return false;
  return ci.entitlements[RC_ENTITLEMENT_ID]?.isActive === true;
}

/**
 * Subscribe to customer info updates.
 * Returns unsubscribe function.
 */
export function addCustomerInfoListener(
  listener: (ci: RCCustomerInfo) => void,
): () => void {
  if (Platform.OS === 'web') return () => {};
  let Purchases: any = null;
  getSDK().then(sdk => {
    if (!sdk) return;
    Purchases = sdk;
    sdk.addCustomerInfoUpdateListener((rawCi: any) => {
      listener(mapCustomerInfo(rawCi));
    });
  });
  return () => {
    if (Purchases) {
      try { Purchases.removeCustomerInfoUpdateListener(listener); } catch {}
    }
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
