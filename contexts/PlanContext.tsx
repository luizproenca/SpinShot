
import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as RC from '../services/revenueCatService';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro';
export type SubscriptionPlan = 'free' | 'pro_monthly' | 'pro_annual';
export type SubscriptionStatus = 'inactive' | 'active' | 'trial' | 'expired' | 'cancelled';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isPro: boolean;
  isTrial: boolean;
  expiresAt: string | null;
  trialStartAt: string | null;
  lastCheckedAt: number | null;
}

export interface PlanContextType {
  subscription: SubscriptionState;
  isPro: boolean;
  isTrial: boolean;
  subscriptionLoading: boolean;

  // RC packages (real prices from store)
  rcPackages: RC.RCPackage[];
  rcPackagesLoading: boolean;

  // Legacy compat
  plan: PlanId;
  isPremium: boolean;
  setPlan: (p: PlanId) => void;

  // Onboarding
  hasSeenOnboarding: boolean;
  markOnboardingSeen: () => void;

  // Paywall
  isPaywallVisible: boolean;
  paywallTrigger: string;
  showPaywall: (trigger?: string) => void;
  hidePaywall: () => void;

  // IAP actions
  purchasePlan: (productId: IAPProductId, platform: 'ios' | 'android' | 'web') => Promise<{ success: boolean; isTrial: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; restored: boolean }>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export type IAPProductId = 'spinshot_pro_monthly' | 'spinshot_pro_annual';

export interface IAPProduct {
  id: IAPProductId;
  plan: 'pro_monthly' | 'pro_annual';
  labelKey: string;
  priceLocal: string;
  priceIntl: string;
  periodKey: string;
  hasTrial: boolean;
  trialDays: number;
  badgeKey?: string;
}

export const IAP_PRODUCTS: IAPProduct[] = [
  {
    id: 'spinshot_pro_monthly',
    plan: 'pro_monthly',
    labelKey: 'monthly',
    priceLocal: 'R$ 79,90',
    priceIntl: 'US$ 19.90',
    periodKey: 'month',
    hasTrial: false,
    trialDays: 0,
  },
  {
    id: 'spinshot_pro_annual',
    plan: 'pro_annual',
    labelKey: 'annual',
    priceLocal: 'R$ 709,90',
    priceIntl: 'US$ 199.90',
    periodKey: 'year',
    hasTrial: true,
    trialDays: 30,
    badgeKey: 'bestValue',
  },
];

// ─── Plan Feature Rules ──────────────────────────────────────────────────────

export interface PlanRules {
  maxEvents: number;
  hasWatermark: boolean;
  maxExportQuality: '480p' | '1080p';
  maxDurationSeconds: number;
  allowPremiumFrames: boolean;
  allowPremiumMusic: boolean;
  allowFrameUpload: boolean;
  allowCinematicEffect: boolean;
  allowHypeEffect: boolean;
  allowEventLogo: boolean;
}

export const FREE_RULES: PlanRules = {
  maxEvents: 1,
  hasWatermark: true,
  maxExportQuality: '480p',
  maxDurationSeconds: 10,
  allowPremiumFrames: false,
  allowPremiumMusic: false,
  allowFrameUpload: false,
  allowCinematicEffect: false,
  allowHypeEffect: false,
  allowEventLogo: false,
};

export const PRO_RULES: PlanRules = {
  maxEvents: Infinity,
  hasWatermark: false,
  maxExportQuality: '1080p',
  maxDurationSeconds: Infinity,
  allowPremiumFrames: true,
  allowPremiumMusic: true,
  allowFrameUpload: true,
  allowCinematicEffect: true,
  allowHypeEffect: true,
  allowEventLogo: true,
};

export function getPlanRules(isPro: boolean): PlanRules {
  return isPro ? PRO_RULES : FREE_RULES;
  //return PRO_RULES;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const PlanContext = createContext<PlanContextType | undefined>(undefined);

const STORAGE_KEYS = {
  subscription: '@spinshot:subscription_v2',
  onboarding:   '@spinshot:onboarding_seen',
};

const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  plan:          'free',
  status:        'inactive',
  isPro:         true,
  isTrial:       false,
  expiresAt:     null,
  trialStartAt:  null,
  lastCheckedAt: null,
};

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 min

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription]         = useState<SubscriptionState>(DEFAULT_SUBSCRIPTION);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isPaywallVisible, setPaywallVisible]   = useState(false);
  const [paywallTrigger, setPaywallTrigger]     = useState('');
  const [loaded, setLoaded]                     = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [rcPackages, setRcPackages]             = useState<RC.RCPackage[]>([]);
  const [rcPackagesLoading, setRcPackagesLoading] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rcListenerUnsubRef = useRef<(() => void) | null>(null);

  // ── Load cache ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [cachedSub, seenOnboarding] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.subscription),
          AsyncStorage.getItem(STORAGE_KEYS.onboarding),
        ]);
        if (cachedSub) {
          const parsed: SubscriptionState = JSON.parse(cachedSub);
          setSubscription(parsed);
        }
        if (seenOnboarding === 'true') setHasSeenOnboarding(true);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // ── Persist cache ─────────────────────────────────────────────────────
  const persistSubscription = useCallback(async (sub: SubscriptionState) => {
    try { await AsyncStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify(sub)); } catch {}
  }, []);

  // ── Apply state from backend response ────────────────────────────────
  const applySubscriptionData = useCallback(async (data: any) => {
    const plan   = data.plan   ?? 'free';
    const status = data.status ?? 'inactive';
    // Derive isPro from plan+status when the response field is absent (e.g. 'activate' action)
    const isPro = data.isPro !== undefined
      ? Boolean(data.isPro)
      : (status === 'active' || status === 'trial') && plan !== 'free';
    const isTrial = data.isTrial !== undefined ? Boolean(data.isTrial) : status === 'trial';
    const newSub: SubscriptionState = {
      plan,
      status,
      isPro,
      isTrial,
      expiresAt:     data.expiresAt    ?? null,
      trialStartAt:  data.trialStartAt ?? null,
      lastCheckedAt: Date.now(),
    };
    setSubscription(newSub);
    await persistSubscription(newSub);
    return newSub;
  }, [persistSubscription]);

  // ── Refresh from backend (with RC check) ─────────────────────────────
  const refreshSubscription = useCallback(async () => {
    try {
      setSubscriptionLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('validate-purchase', {
        body: { action: 'check' },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() ?? msg; } catch {}
        }
        console.warn('[PlanContext] refreshSubscription error:', msg);
        return;
      }

      await applySubscriptionData(data);
    } catch (e) {
      console.warn('[PlanContext] refreshSubscription exception:', e);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [applySubscriptionData]);

  // ── Load RC packages ──────────────────────────────────────────────────
  const loadRCPackages = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setRcPackagesLoading(true);
    try {
      const pkgs = await RC.getOfferings();
      if (pkgs.length > 0) setRcPackages(pkgs);
    } catch (e) {
      console.warn('[PlanContext] loadRCPackages error:', e);
    } finally {
      setRcPackagesLoading(false);
    }
  }, []);

  // ── CustomerInfo listener ─────────────────────────────────────────────
  const setupRCListener = useCallback(() => {
    if (Platform.OS === 'web') return;
    rcListenerUnsubRef.current = RC.addCustomerInfoListener(async (ci) => {
      const isPro   = RC.isProActive(ci);
      const supabase = getSupabaseClient();
      // Push validated state to backend
      try {
        const { data } = await supabase.functions.invoke('validate-purchase', {
          body: { action: 'rc_validate', customerInfoJson: ci.raw, platform: Platform.OS },
        });
        if (data) await applySubscriptionData(data);
      } catch {
        // Optimistic update from RC client data
        const newSub: SubscriptionState = {
          ...DEFAULT_SUBSCRIPTION,
          isPro,
          plan:          isPro ? 'pro_monthly' : 'free',
          status:        isPro ? 'active' : 'inactive',
          lastCheckedAt: Date.now(),
        };
        setSubscription(newSub);
        await persistSubscription(newSub);
      }
    });
  }, [applySubscriptionData, persistSubscription]);

  // ── Periodic refresh ──────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;

    const shouldRefresh =
      !subscription.lastCheckedAt ||
      Date.now() - subscription.lastCheckedAt > REFRESH_INTERVAL_MS;

    if (shouldRefresh) refreshSubscription();

    refreshTimerRef.current = setInterval(refreshSubscription, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [loaded, subscription.lastCheckedAt, refreshSubscription]); // Corrected dependencies

  // ── RevenueCat init (after auth) ──────────────────────────────────────
  // Called after user logs in — see useAuth integration below
  // PlanContext doesn't know user id directly; RC init is triggered from AuthContext
  // via the exported initRC helper.

  // Setup RC listener & load packages on mount
  useEffect(() => {
    if (!loaded) return;
    setupRCListener();
    loadRCPackages();
    return () => {
      rcListenerUnsubRef.current?.();
    };
  }, [loaded, setupRCListener, loadRCPackages]); // Corrected dependencies

  // ── Purchase via RevenueCat SDK ───────────────────────────────────────
  const purchasePlan = useCallback(async (
    productId: IAPProductId,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean; isTrial: boolean; error?: string }> => {
    setSubscriptionLoading(true);
    try {
      // WEB: use mock/backend-only flow
      if (platform === 'web') {
        return await webPurchaseFallback(productId, platform, applySubscriptionData);
      }

      // MOBILE: use real RevenueCat SDK
      const packages = rcPackages.length > 0 ? rcPackages : await RC.getOfferings();

      const pkg = packages.find(p =>
        p.productIdentifier === productId ||
        (productId === 'spinshot_pro_monthly' && p.identifier === '$rc_monthly') ||
        (productId === 'spinshot_pro_annual'  && p.identifier === '$rc_annual')
      );

      if (!pkg) {
        // RC package not found — fall back to backend activation
        console.warn('[PlanContext] RC package not found for:', productId, '— falling back to backend activate');
        return await webPurchaseFallback(productId, platform, applySubscriptionData);
      }

      const result = await RC.purchasePackage(pkg);

      if (result.isCancelled) {
        return { success: false, isTrial: false, error: 'cancelled' };
      }

      if (!result.success || !result.customerInfo) {
        return { success: false, isTrial: false, error: result.error ?? 'Purchase failed' };
      }

      // Validate with backend — RC REST API will confirm
      const supabase = getSupabaseClient();
      const { data, error: fnError } = await supabase.functions.invoke('validate-purchase', {
        body: {
          action:          'rc_validate',
          customerInfoJson: result.customerInfo.raw,
          platform,
        },
      });

      if (fnError) {
        let msg = fnError.message;
        if (fnError instanceof FunctionsHttpError) {
          try { msg = await fnError.context?.text() ?? msg; } catch {}
        }
        // Purchase happened on RC — store optimistic Pro state
        const newSub: SubscriptionState = {
          plan:          productId === 'spinshot_pro_annual' ? 'pro_annual' : 'pro_monthly',
          status:        'active',
          isPro:         true,
          isTrial:       false,
          expiresAt:     result.customerInfo.latestExpirationDate,
          trialStartAt:  null,
          lastCheckedAt: Date.now(),
        };
        setSubscription(newSub);
        await persistSubscription(newSub);
        return { success: true, isTrial: false };
      }

      const applied = await applySubscriptionData(data);
      return { success: true, isTrial: applied.isTrial };

    } catch (e: any) {
      return { success: false, isTrial: false, error: e.message };
    } finally {
      setSubscriptionLoading(false);
    }
  }, [rcPackages, applySubscriptionData, persistSubscription]);

  // ── Restore via RevenueCat SDK ────────────────────────────────────────
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; restored: boolean }> => {
    setSubscriptionLoading(true);
    try {
      if (Platform.OS !== 'web') {
        // Use RC SDK restore
        const result = await RC.restorePurchases();

        if (result.success && result.customerInfo) {
          const isPro = RC.isProActive(result.customerInfo);
          // Sync to backend
          const supabase = getSupabaseClient();
          const { data } = await supabase.functions.invoke('validate-purchase', {
            body: { action: 'restore', platform: Platform.OS },
          });

          if (data) {
            await applySubscriptionData(data);
            return { success: true, restored: data.isPro ?? isPro };
          }

          // Optimistic
          if (isPro) {
            const newSub: SubscriptionState = {
              ...DEFAULT_SUBSCRIPTION,
              isPro:         true,
              plan:          'pro_monthly',
              status:        'active',
              lastCheckedAt: Date.now(),
            };
            setSubscription(newSub);
            await persistSubscription(newSub);
          }

          return { success: true, restored: isPro };
        }

        if (!result.success) {
          return { success: false, restored: false };
        }

        return { success: true, restored: false };

      } else {
        // Web: check backend state
        await refreshSubscription();
        return { success: true, restored: subscription.isPro };
      }
    } catch {
      return { success: false, restored: false };
    } finally {
      setSubscriptionLoading(false);
    }
  }, [applySubscriptionData, persistSubscription, refreshSubscription, subscription.isPro]);

  // ── Cancel ────────────────────────────────────────────────────────────
  const cancelSubscription = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.functions.invoke('validate-purchase', { body: { action: 'cancel' } });
      await refreshSubscription();
    } catch (e) {
      console.warn('[PlanContext] cancelSubscription error:', e);
    }
  }, [refreshSubscription]);

  // ── Onboarding ────────────────────────────────────────────────────────
  const markOnboardingSeen = useCallback(async () => {
    setHasSeenOnboarding(true);
    try { await AsyncStorage.setItem(STORAGE_KEYS.onboarding, 'true'); } catch {}
  }, []);

  // ── Paywall ───────────────────────────────────────────────────────────
  const showPaywall = useCallback((trigger = 'generic') => {
    setPaywallTrigger(trigger);
    setPaywallVisible(true);
    // Refresh packages when paywall opens
    loadRCPackages();
  }, [loadRCPackages]);

  const hidePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallTrigger('');
  }, []);

  // ── Legacy ────────────────────────────────────────────────────────────
  const setPlan = useCallback((_p: PlanId) => {
    console.warn('[PlanContext] setPlan is deprecated, use purchasePlan instead');
  }, []);

  if (!loaded) return null;

  const isPro = subscription.isPro;

  return (
    <PlanContext.Provider value={{
      subscription,
      isPro,
      isTrial:            subscription.isTrial,
      subscriptionLoading,
      rcPackages,
      rcPackagesLoading,
      plan:               isPro ? 'pro' : 'free',
      isPremium:          isPro,
      setPlan,
      hasSeenOnboarding,
      markOnboardingSeen,
      isPaywallVisible,
      paywallTrigger,
      showPaywall,
      hidePaywall,
      purchasePlan,
      restorePurchases,
      cancelSubscription,
      refreshSubscription,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

// ─── Web / fallback purchase ──────────────────────────────────────────────────

async function webPurchaseFallback(
  productId: IAPProductId,
  platform: string,
  applySubscriptionData: (data: any) => Promise<any>,
): Promise<{ success: boolean; isTrial: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('validate-purchase', {
      body: {
        action:        'activate',
        productId,
        platform,
        purchaseToken: `web_token_${Date.now()}`,
      },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context?.text() ?? msg; } catch {}
      }
      return { success: false, isTrial: false, error: msg };
    }

    const applied = await applySubscriptionData(data);
    return { success: true, isTrial: applied.isTrial };
  } catch (e: any) {
    return { success: false, isTrial: false, error: e.message };
  }
}

// ─── RC init helper (called from AuthContext after login) ─────────────────────

export async function initPlanRevenueCat(userId: string): Promise<void> {
  await RC.initRevenueCat(userId);
}

export async function logOutPlanRevenueCat(): Promise<void> {
  await RC.logOutRevenueCat();
}
