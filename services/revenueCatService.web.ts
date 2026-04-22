/**
 * SpinShot 360 — RevenueCat Service (Web stub)
 * react-native-purchases is not available on web. All functions are no-ops.
 */

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
  monthly: 'pro_monthly',
  annual:  'pro_annual',
} as const;

// ─── No-op stubs for web ──────────────────────────────────────────────────────

export async function initRevenueCat(_appUserId: string): Promise<void> {}

export async function logOutRevenueCat(): Promise<void> {}

export async function getOfferings(): Promise<RCPackage[]> {
  return [];
}

export async function purchasePackage(_pkg: RCPackage): Promise<PurchaseResult> {
  return { success: false, customerInfo: null, isCancelled: false, error: 'Not supported on web' };
}

export async function restorePurchases(): Promise<RestoreResult> {
  return { success: false, customerInfo: null, error: 'Not supported on web' };
}

export async function getCustomerInfo(): Promise<RCCustomerInfo | null> {
  return null;
}

export function isProActive(_ci: RCCustomerInfo | null): boolean {
  return false;
}

export function addCustomerInfoListener(
  _listener: (ci: RCCustomerInfo) => void,
): () => void {
  return () => {};
}
