import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as RC from '../services/revenueCatService';
import { logFunnelEvent } from '../services/funnelAnalyticsService';
import { AuthContext } from './AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro';
export type SubscriptionPlan = 'free' | 'pro_monthly' | 'pro_annual';
export type SubscriptionStatus = 'inactive' | 'active' | 'trial' | 'expired' | 'cancelled';
export type IAPProductId = 'spinshot_pro_monthly' | 'spinshot_pro_annual';
// Consumable one-off purchase — unlocks a single specific event (see
// purchaseEventPass below), independent of any subscription. Consumable
// products are never Family-Shareable on the App Store, unlike
// non-consumables, which sidesteps that whole abuse vector for free.
export type EventPassProductId = 'spinshot_event_pass';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isPro: boolean;
  isTrial: boolean;
  expiresAt: string | null;
  trialStartAt: string | null;
  lastCheckedAt: number | null;
  // How many times this account has had a purchase refunded — after 2,
  // one-off event passes are restricted (subscription stays available).
  refundCount: number;
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
  purchasePlan: (
    productId: IAPProductId,
    platform: 'ios' | 'android' | 'web'
  ) => Promise<{ success: boolean; isTrial: boolean; error?: string }>;
  // Consumable one-off purchase that unlocks a single specific event —
  // independent of any subscription. See supabase/functions/validate-purchase
  // action 'unlock_event'.
  purchaseEventPass: (
    eventId: string,
    platform: 'ios' | 'android' | 'web'
  ) => Promise<{ success: boolean; error?: string; chargedNotApplied?: boolean }>;
  // Re-applies an event pass that was already paid for but never got
  // unlocked (e.g. network dropped between the charge and the unlock
  // call) — no new purchase, safe to call as a "try again" action.
  restoreEventPass: (
    eventId: string,
    platform: 'ios' | 'android' | 'web'
  ) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; restored: boolean }>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

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
  maxDurationSeconds: Infinity,
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
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const PlanContext = createContext<PlanContextType | undefined>(undefined);

const STORAGE_KEYS = {
  subscription: '@spinshot:subscription_v2',
  onboarding: '@spinshot:onboarding_seen',
};

const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  plan: 'free',
  status: 'inactive',
  isPro: false,
  isTrial: false,
  expiresAt: null,
  trialStartAt: null,
  lastCheckedAt: null,
  refundCount: 0,
};

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 min

const RC_PRODUCT_MAP: Record<IAPProductId, { identifiers: string[]; productIdentifier: string }> = {
  spinshot_pro_monthly: {
    identifiers: ['$rc_monthly', 'pro_monthly'],
    productIdentifier: 'com.ironman.spinshot.app.pro.monthly',
  },
  spinshot_pro_annual: {
    identifiers: ['$rc_annual', 'pro_annual'],
    productIdentifier: 'com.ironman.spinshot.app.pro.annual',
  },
};

const EVENT_PASS_PRODUCT: { identifiers: string[]; productIdentifier: string } = {
  identifiers: ['spinshot_event_pass'],
  productIdentifier: 'com.ironman.spinshot.app.event.pass',
};

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const authCtx = useContext(AuthContext);
  const authUser = authCtx?.user;

  const [subscription, setSubscription] = useState<SubscriptionState>(DEFAULT_SUBSCRIPTION);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isPaywallVisible, setPaywallVisible] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [rcPackages, setRcPackages] = useState<RC.RCPackage[]>([]);
  const [rcPackagesLoading, setRcPackagesLoading] = useState(false);

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

        if (seenOnboarding === 'true') {
          setHasSeenOnboarding(true);
        }
      } catch {}

      setLoaded(true);
    })();
  }, []);

  // ── Persist cache ─────────────────────────────────────────────────────
  const persistSubscription = useCallback(async (sub: SubscriptionState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify(sub));
    } catch {}
  }, []);

  // ── Apply state from backend response ────────────────────────────────
  const applySubscriptionData = useCallback(async (data: any) => {
    const plan = data.plan ?? 'free';
    const status = data.status ?? 'inactive';
    const isPro = data.isPro !== undefined
      ? Boolean(data.isPro)
      : (status === 'active' || status === 'trial') && plan !== 'free';
    const isTrial = data.isTrial !== undefined ? Boolean(data.isTrial) : status === 'trial';

    const newSub: SubscriptionState = {
      plan,
      status,
      isPro,
      isTrial,
      expiresAt: data.expiresAt ?? null,
      trialStartAt: data.trialStartAt ?? null,
      lastCheckedAt: Date.now(),
      refundCount: data.refundCount ?? 0,
    };

    setSubscription(newSub);
    await persistSubscription(newSub);
    return newSub;
  }, [persistSubscription]);

  // ── Refresh from backend ──────────────────────────────────────────────
  const refreshSubscription = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
    } catch {
      return;
    }

    try {
      setSubscriptionLoading(true);

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('validate-purchase', {
        body: { action: 'check' },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            msg = await error.context?.text() ?? msg;
          } catch {}
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
    if (Platform.OS === 'web') {
      setRcPackages([]);
      setRcPackagesLoading(false);
      return;
    }

    setRcPackagesLoading(true);

    try {
      const pkgs = await RC.getOfferings();
      console.log('[PlanContext] RC offerings:', JSON.stringify(pkgs, null, 2));
      setRcPackages(pkgs);
    } catch (e) {
      console.warn('[PlanContext] loadRCPackages error:', e);
      setRcPackages([]);
    } finally {
      setRcPackagesLoading(false);
    }
  }, []);

  // ── CustomerInfo listener ─────────────────────────────────────────────
  const setupRCListener = useCallback(() => {
    if (Platform.OS === 'web') return;

    rcListenerUnsubRef.current = RC.addCustomerInfoListener(async (ci) => {
      const isProRC = RC.isProActive(ci);
      const supabase = getSupabaseClient();

      try {
        const { data } = await supabase.functions.invoke('validate-purchase', {
          body: {
            action: 'rc_validate',
            customerInfoJson: ci.raw,
            platform: Platform.OS,
          },
        });

        if (data) {
          await applySubscriptionData(data);
        }
      } catch {
        const newSub: SubscriptionState = {
          ...DEFAULT_SUBSCRIPTION,
          isPro: isProRC,
          plan: isProRC ? 'pro_monthly' : 'free',
          status: isProRC ? 'active' : 'inactive',
          lastCheckedAt: Date.now(),
        };

        setSubscription(newSub);
        await persistSubscription(newSub);
      }
    });
  }, [applySubscriptionData, persistSubscription]);

  // ── Init RC + refresh + listener — re-runs (with full teardown) every time
  // the logged-in user changes, not just once. It used to only run once ever
  // (guarded by a ref), so logging out and into a different account on the
  // same device kept the *previous* user's RevenueCat listener and refresh
  // timer alive, which could briefly apply stale subscription data to the
  // new account until the next manual refresh corrected it.
  useEffect(() => {
    if (!loaded) return;

    if (authUser?.id) {
      RC.initRevenueCat(authUser.id).catch(() => {});
    } else {
      RC.logOutRevenueCat().catch(() => {});
      setRcPackages([]);
    }

    refreshSubscription();
    setupRCListener();
    loadRCPackages();

    refreshTimerRef.current = setInterval(() => {
      refreshSubscription();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      rcListenerUnsubRef.current?.();
      rcListenerUnsubRef.current = null;
    };
  }, [loaded, authUser?.id, refreshSubscription, setupRCListener, loadRCPackages]);

  // ── Purchase via RevenueCat SDK ───────────────────────────────────────
  const purchasePlan = useCallback(async (
    productId: IAPProductId,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean; isTrial: boolean; error?: string }> => {
    setSubscriptionLoading(true);
    logFunnelEvent(authUser?.id, 'purchase_attempted', paywallTrigger, { productId, platform });

    try {
      if (platform === 'web') {
        const webResult = await webPurchaseFallback(productId, platform, applySubscriptionData);
        logFunnelEvent(
          authUser?.id,
          webResult.success ? 'purchase_completed' : 'purchase_failed',
          paywallTrigger,
          { productId, platform, error: webResult.error },
        );
        return webResult;
      }

      const packages = rcPackages.length > 0 ? rcPackages : await RC.getOfferings();
      const mapping = RC_PRODUCT_MAP[productId];

      const pkg = packages.find(p =>
        p.productIdentifier === mapping.productIdentifier ||
        mapping.identifiers.includes(p.identifier)
      );

      if (!pkg) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { productId, platform, error: 'plan_not_available' });
        return {
          success: false,
          isTrial: false,
          error: 'Plano não disponível na loja.',
        };
      }

      const result = await RC.purchasePackage(pkg);

      if (result.isCancelled) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { productId, platform, error: 'cancelled' });
        return { success: false, isTrial: false, error: 'cancelled' };
      }

      if (!result.success || !result.customerInfo) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { productId, platform, error: result.error ?? 'purchase_failed' });
        return {
          success: false,
          isTrial: false,
          error: result.error ?? 'Purchase failed',
        };
      }

      const supabase = getSupabaseClient();
      const { data, error: fnError } = await supabase.functions.invoke('validate-purchase', {
        body: {
          action: 'rc_validate',
          customerInfoJson: result.customerInfo.raw,
          platform,
        },
      });

      if (fnError) {
        const newSub: SubscriptionState = {
          plan: productId === 'spinshot_pro_annual' ? 'pro_annual' : 'pro_monthly',
          status: 'active',
          isPro: true,
          isTrial: false,
          expiresAt: result.customerInfo.latestExpirationDate,
          trialStartAt: null,
          lastCheckedAt: Date.now(),
          refundCount: subscription.refundCount,
        };

        setSubscription(newSub);
        await persistSubscription(newSub);

        logFunnelEvent(authUser?.id, 'purchase_completed', paywallTrigger, { productId, platform });
        return { success: true, isTrial: false };
      }

      const applied = await applySubscriptionData(data);
      logFunnelEvent(authUser?.id, 'purchase_completed', paywallTrigger, { productId, platform, isTrial: applied.isTrial });
      return { success: true, isTrial: applied.isTrial };
    } catch (e: any) {
      logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { productId, platform, error: e.message });
      return { success: false, isTrial: false, error: e.message };
    } finally {
      setSubscriptionLoading(false);
    }
  }, [rcPackages, applySubscriptionData, persistSubscription, authUser?.id, paywallTrigger, subscription.refundCount]);

  // ── Purchase a one-off event pass (consumable, unlocks a single event) ─
  // Calls validate-purchase's unlock_event action and interprets the
  // result — shared by purchaseEventPass (right after a fresh purchase)
  // and restoreEventPass (retrying to apply an already-paid-for purchase
  // that never got applied, e.g. the app died between charge and this
  // call — no new charge involved, unlock_event is safe to call again).
  const applyEventUnlock = useCallback(async (
    eventId: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean; error?: string }> => {
    const supabase = getSupabaseClient();
    const { data, error: fnError } = await supabase.functions.invoke('validate-purchase', {
      body: { action: 'unlock_event', eventId, platform },
    });

    if (fnError || !data?.success) {
      return { success: false, error: data?.error ?? fnError?.message ?? 'unlock_failed' };
    }
    return { success: true };
  }, []);

  const purchaseEventPass = useCallback(async (
    eventId: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean; error?: string; chargedNotApplied?: boolean }> => {
    if (platform === 'web') {
      return { success: false, error: 'Compra avulsa não disponível na web.' };
    }

    setSubscriptionLoading(true);
    logFunnelEvent(authUser?.id, 'purchase_attempted', paywallTrigger, { product: 'event_pass', eventId, platform });

    try {
      const packages = rcPackages.length > 0 ? rcPackages : await RC.getOfferings();

      const pkg = packages.find(p =>
        p.productIdentifier === EVENT_PASS_PRODUCT.productIdentifier ||
        EVENT_PASS_PRODUCT.identifiers.includes(p.identifier)
      );

      if (!pkg) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { product: 'event_pass', eventId, platform, error: 'plan_not_available' });
        return { success: false, error: 'Pacote de evento não disponível na loja.' };
      }

      const result = await RC.purchasePackage(pkg);

      if (result.isCancelled) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { product: 'event_pass', eventId, platform, error: 'cancelled' });
        return { success: false, error: 'cancelled' };
      }

      if (!result.success || !result.customerInfo) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { product: 'event_pass', eventId, platform, error: result.error ?? 'purchase_failed' });
        return { success: false, error: result.error ?? 'Purchase failed' };
      }

      // Purchase succeeded and was charged — from here on, any failure is
      // "paid but not applied", not "not purchased", so the UI should
      // offer a retry (restoreEventPass) instead of buying again.
      const applied = await applyEventUnlock(eventId, platform);

      if (!applied.success) {
        logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { product: 'event_pass', eventId, platform, error: applied.error, chargedNotApplied: true });
        return { success: false, error: applied.error, chargedNotApplied: true };
      }

      logFunnelEvent(authUser?.id, 'purchase_completed', paywallTrigger, { product: 'event_pass', eventId, platform });
      return { success: true };
    } catch (e: any) {
      logFunnelEvent(authUser?.id, 'purchase_failed', paywallTrigger, { product: 'event_pass', eventId, platform, error: e.message });
      return { success: false, error: e.message };
    } finally {
      setSubscriptionLoading(false);
    }
  }, [rcPackages, authUser?.id, paywallTrigger, applyEventUnlock]);

  // Retry applying an event pass that was already paid for — no new
  // RC.purchasePackage call, so this never charges twice.
  const restoreEventPass = useCallback(async (
    eventId: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean; error?: string }> => {
    setSubscriptionLoading(true);
    try {
      const result = await applyEventUnlock(eventId, platform);
      logFunnelEvent(
        authUser?.id,
        result.success ? 'purchase_completed' : 'purchase_failed',
        paywallTrigger,
        { product: 'event_pass', eventId, platform, error: result.error, restore: true },
      );
      return result;
    } finally {
      setSubscriptionLoading(false);
    }
  }, [authUser?.id, paywallTrigger, applyEventUnlock]);

  // ── Restore via RevenueCat SDK ────────────────────────────────────────
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; restored: boolean }> => {
    setSubscriptionLoading(true);

    try {
      if (Platform.OS !== 'web') {
        const result = await RC.restorePurchases();

        if (result.success && result.customerInfo) {
          const isProRC = RC.isProActive(result.customerInfo);
          const supabase = getSupabaseClient();

          const { data } = await supabase.functions.invoke('validate-purchase', {
            body: { action: 'restore', platform: Platform.OS },
          });

          if (data) {
            await applySubscriptionData(data);
            return { success: true, restored: data.isPro ?? isProRC };
          }

          if (isProRC) {
            const newSub: SubscriptionState = {
              ...DEFAULT_SUBSCRIPTION,
              isPro: true,
              plan: 'pro_monthly',
              status: 'active',
              lastCheckedAt: Date.now(),
            };

            setSubscription(newSub);
            await persistSubscription(newSub);
          }

          return { success: true, restored: isProRC };
        }

        if (!result.success) {
          return { success: false, restored: false };
        }

        return { success: true, restored: false };
      }

      await refreshSubscription();
      return { success: true, restored: subscription.isPro };
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
      await supabase.functions.invoke('validate-purchase', {
        body: { action: 'cancel' },
      });

      await refreshSubscription();
    } catch (e) {
      console.warn('[PlanContext] cancelSubscription error:', e);
    }
  }, [refreshSubscription]);

  // ── Onboarding ────────────────────────────────────────────────────────
  const markOnboardingSeen = useCallback(async () => {
    setHasSeenOnboarding(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.onboarding, 'true');
    } catch {}
  }, []);

  // ── Paywall ───────────────────────────────────────────────────────────
  const showPaywall = useCallback((trigger = 'generic') => {
    setPaywallTrigger(trigger);
    setPaywallVisible(true);
    loadRCPackages();
    logFunnelEvent(authUser?.id, 'paywall_viewed', trigger);
  }, [loadRCPackages, authUser?.id]);

  const hidePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallTrigger('');
  }, []);

  // ── Legacy ────────────────────────────────────────────────────────────
  const setPlan = useCallback((_p: PlanId) => {
    console.warn('[PlanContext] setPlan is deprecated, use purchasePlan instead');
  }, []);

  const isPro = subscription.isPro;

  return (
    <PlanContext.Provider
      value={{
        subscription,
        isPro,
        isTrial: subscription.isTrial,
        subscriptionLoading,

        rcPackages,
        rcPackagesLoading,

        plan: isPro ? 'pro' : 'free',
        isPremium: isPro,
        setPlan,

        hasSeenOnboarding,
        markOnboardingSeen,

        isPaywallVisible,
        paywallTrigger,
        showPaywall,
        hidePaywall,

        purchasePlan,
        purchaseEventPass,
        restoreEventPass,
        restorePurchases,
        cancelSubscription,
        refreshSubscription,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

// ─── Web / fallback purchase ─────────────────────────────────────────────────

async function webPurchaseFallback(
  productId: IAPProductId,
  platform: string,
  applySubscriptionData: (data: any) => Promise<any>,
): Promise<{ success: boolean; isTrial: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.functions.invoke('validate-purchase', {
      body: {
        action: 'activate',
        productId,
        platform,
        purchaseToken: `web_token_${Date.now()}`,
      },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          msg = await error.context?.text() ?? msg;
        } catch {}
      }
      return { success: false, isTrial: false, error: msg };
    }

    const applied = await applySubscriptionData(data);
    return { success: true, isTrial: applied.isTrial };
  } catch (e: any) {
    return { success: false, isTrial: false, error: e.message };
  }
}