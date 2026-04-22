/**
 * SpinShot 360 — Subscription Management / Paywall Screen
 * Accessible from Settings → Manage subscription
 * Dynamic prices from RevenueCat offerings
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { usePlan } from '../hooks/usePlan';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  formatExpiryDate,
  getTrialRemainingDays,
  getCurrentPlatform,
} from '../services/subscriptionService';

// ─── Links legais ────────────────────────────────────────────────────────────
const PRIVACY_URL = 'https://luizproenca.github.io/SpinShot/privacy.html';
const TERMS_URL = 'https://luizproenca.github.io/SpinShot/terms.html';

interface Feature {
  icon: string;
  labelKey: string;
  proOnly: boolean;
}

const FEATURES: Feature[] = [
  { icon: 'hide-source',    labelKey: 'featureNoWatermark',    proOnly: true },
  { icon: 'hd',             labelKey: 'featureFullHD',          proOnly: true },
  { icon: 'all-inclusive',  labelKey: 'featureUnlimitedEvents', proOnly: true },
  { icon: 'timer',          labelKey: 'featureLongVideos',      proOnly: true },
  { icon: 'auto-awesome',   labelKey: 'featureAllEffects',      proOnly: true },
  { icon: 'layers',         labelKey: 'featurePremiumFrames',   proOnly: true },
  { icon: 'music-note',     labelKey: 'featurePremiumMusic',    proOnly: true },
  { icon: 'business',       labelKey: 'featureEventLogo',       proOnly: true },
];

type StorePlan = {
  productId: 'pro_monthly' | 'pro_annual';
  title: string;
  price: string;
  introPrice: string | null;
  identifier: string;
  kind: 'monthly' | 'annual';
};

function resolveStorePlans(rcPackages: Array<{
  identifier: string;
  productIdentifier: string;
  priceString: string;
  introPrice: string | null;
}>) {
  const monthlyPkg =
    rcPackages.find(p => p.productIdentifier === 'pro_monthly') ??
    rcPackages.find(p => p.identifier === '$rc_monthly') ??
    null;

  const annualPkg =
    rcPackages.find(p => p.productIdentifier === 'pro_annual') ??
    rcPackages.find(p => p.identifier === '$rc_annual') ??
    null;

  const monthly: StorePlan | null = monthlyPkg
    ? {
        productId: 'pro_monthly',
        title: 'Mensal',
        price: monthlyPkg.priceString,
        introPrice: monthlyPkg.introPrice,
        identifier: monthlyPkg.identifier,
        kind: 'monthly',
      }
    : null;

  const annual: StorePlan | null = annualPkg
    ? {
        productId: 'pro_annual',
        title: 'Anual',
        price: annualPkg.priceString,
        introPrice: annualPkg.introPrice,
        identifier: annualPkg.identifier,
        kind: 'annual',
      }
    : null;

  return {
    monthly,
    annual,
    hasAnyPlan: Boolean(monthly || annual),
  };
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();
  const ts = (t as any).subscription as Record<string, string>;

  const {
    subscription,
    isPro,
    subscriptionLoading,
    rcPackages,
    rcPackagesLoading,
    showPaywall,
    purchasePlan,
    restorePurchases,
    cancelSubscription,
    refreshSubscription,
  } = usePlan();

  const [restoring, setRestoring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const { monthly, annual, hasAnyPlan } = useMemo(
    () => resolveStorePlans(rcPackages),
    [rcPackages]
  );

  // ── Derived ──────────────────────────────────────────────────────────────
  const isActive = subscription.status === 'active';
  const isTrialActive = subscription.status === 'trial';
  const isExpired = subscription.status === 'expired' || subscription.status === 'cancelled';
  const isCancelled = subscription.status === 'cancelled';

  const trialDaysLeft = getTrialRemainingDays(subscription.trialStartAt);
  const expiryFormatted = formatExpiryDate(subscription.expiresAt, language);

  const planLabel = isPro
    ? (subscription.plan === 'pro_annual'
        ? (t.settings as any).planAnnual
        : (t.settings as any).planMonthly)
    : (t.settings as any).freePlan;

  const statusColor = isTrialActive
    ? Colors.Warning
    : isActive
    ? Colors.Success
    : isExpired
    ? Colors.Error
    : Colors.TextMuted;

  const statusIcon: any = isTrialActive
    ? 'hourglass-top'
    : isActive
    ? 'check-circle'
    : isExpired
    ? 'warning'
    : 'info';

  const statusLabel = isTrialActive
    ? ts.statusTrial
    : isActive
    ? ts.statusActive
    : isCancelled
    ? ts.statusCancelled
    : isExpired
    ? ts.statusExpired
    : ts.statusInactive;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);

    if (result.success) {
      showAlert(
        (t.common as any).success,
        result.restored ? ts.restoreSuccess : ts.restoreNotFound,
      );
    } else {
      showAlert((t.common as any).error, ts.restoreError);
    }
  }, [restorePurchases, showAlert, t, ts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshSubscription();
    setRefreshing(false);
  }, [refreshSubscription]);

  const handleCancel = useCallback(() => {
    showAlert(ts.cancelConfirm, ts.cancelMsg, [
      { text: (t.common as any).cancel, style: 'cancel' },
      {
        text: ts.cancelAction,
        style: 'destructive',
        onPress: async () => {
          await cancelSubscription();
          showAlert((t.common as any).success, ts.cancelDone);
        },
      },
    ]);
  }, [cancelSubscription, showAlert, t, ts]);

  const openUrl = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showAlert((t.common as any).error, 'Não foi possível abrir o link.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      showAlert((t.common as any).error, 'Não foi possível abrir o link.');
    }
  }, [showAlert, t]);

  const handlePurchase = useCallback(async (plan: StorePlan) => {
    setPurchasingId(plan.productId);
    try {
      const result = await purchasePlan(plan.productId, getCurrentPlatform());

      if (result.success) {
        showAlert(
          (t.common as any).success,
          result.isTrial
            ? 'Assinatura iniciada com período promocional.'
            : 'Assinatura ativada com sucesso.'
        );
        return;
      }

      if (result.error === 'cancelled') return;

      showAlert(
        (t.common as any).error,
        result.error || 'Não foi possível concluir a compra.'
      );
    } finally {
      setPurchasingId(null);
    }
  }, [purchasePlan, showAlert, t]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.TextPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{ts.title}</Text>
        <Pressable
          style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleRefresh}
          disabled={refreshing || subscriptionLoading}
          hitSlop={8}
        >
          {refreshing || subscriptionLoading
            ? <ActivityIndicator size="small" color={Colors.TextMuted} />
            : <MaterialIcons name="refresh" size={20} color={Colors.TextMuted} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero plan card ── */}
        <LinearGradient
          colors={isPro ? ['#7C3AED33', '#4F46E522'] : ['#1A1740', '#12102A']}
          style={[
            styles.planCard,
            { borderColor: isPro ? Colors.Primary + '55' : Colors.Border },
          ]}
        >
          <View style={[
            styles.planIconWrap,
            { backgroundColor: isPro ? Colors.Primary + '22' : Colors.SurfaceElevated },
          ]}>
            <MaterialIcons
              name={isPro ? 'star' : 'lock-open'}
              size={32}
              color={isPro ? Colors.Primary : Colors.TextMuted}
            />
          </View>

          <View style={styles.planInfo}>
            <Text style={styles.planName}>
              {isPro ? `SpinShot Pro · ${planLabel}` : ts.freePlan}
            </Text>
            <Text style={styles.planSub}>
              {isPro ? ts.proSub : ts.freeSub}
            </Text>

            {isPro && (
              <Text style={styles.subscriptionMeta}>
                {subscription.plan === 'pro_annual' ? '1 ano' : '1 mês'}
              </Text>
            )}
          </View>

          {isPro && (
            <View style={styles.proBadge}>
              <MaterialIcons name="star" size={11} color={Colors.Primary} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Status strip ── */}
        <View style={[
          styles.statusStrip,
          { backgroundColor: statusColor + '18', borderColor: statusColor + '44' },
        ]}>
          <MaterialIcons name={statusIcon} size={18} color={statusColor} />
          <View style={styles.statusBody}>
            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>

            {isTrialActive && trialDaysLeft > 0 && (
              <View style={styles.trialCountdown}>
                <Text style={[styles.trialDays, { color: Colors.Warning }]}>
                  {trialDaysLeft}
                </Text>
                <Text style={styles.trialDaysLabel}>
                  {' '}{ts.trialDaysLeft}
                </Text>
              </View>
            )}

            {isTrialActive && subscription.expiresAt && (
              <Text style={styles.statusMeta}>
                {ts.trialEndsOn}: {expiryFormatted}
              </Text>
            )}

            {isActive && !isTrialActive && subscription.expiresAt && (
              <Text style={styles.statusMeta}>
                {ts.renewsOn}: {expiryFormatted}
              </Text>
            )}

            {isExpired && subscription.expiresAt && (
              <Text style={styles.statusMeta}>
                {ts.expiredOn}: {expiryFormatted}
              </Text>
            )}
          </View>
          {subscriptionLoading && (
            <ActivityIndicator size="small" color={statusColor} />
          )}
        </View>

        {/* ── Dynamic paywall ── */}
        {!isPro && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{ts.upgradeCta}</Text>

            {rcPackagesLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.Primary} />
                <Text style={styles.loadingText}>Carregando planos da loja…</Text>
              </View>
            ) : hasAnyPlan ? (
              <View style={styles.paywallStack}>
                {monthly && (
                  <Pressable
                    style={({ pressed }) => [styles.planOption, { opacity: pressed ? 0.92 : 1 }]}
                    onPress={() => handlePurchase(monthly)}
                    disabled={purchasingId !== null}
                  >
                    <LinearGradient
                      colors={['#1A1740', '#12102A']}
                      style={styles.planOptionGradient}
                    >
                      <View style={styles.planOptionHeader}>
                        <View style={styles.planOptionTitleWrap}>
                          <Text style={styles.planOptionTitle}>{monthly.title}</Text>
                          <Text style={styles.planOptionSubtitle}>Renovação automática</Text>
                        </View>
                        <MaterialIcons name="calendar-month" size={22} color={Colors.Primary} />
                      </View>

                      <Text style={styles.planOptionPrice}>{monthly.price}</Text>

                      {monthly.introPrice && (
                        <Text style={styles.planOptionMeta}>
                          Oferta introdutória disponível
                        </Text>
                      )}

                      <View style={styles.planOptionButton}>
                        {purchasingId === monthly.productId ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.planOptionButtonText}>Assinar mensal</Text>
                            <MaterialIcons name="chevron-right" size={18} color="#fff" />
                          </>
                        )}
                      </View>
                    </LinearGradient>
                  </Pressable>
                )}

                {annual && (
                  <Pressable
                    style={({ pressed }) => [styles.planOption, { opacity: pressed ? 0.92 : 1 }]}
                    onPress={() => handlePurchase(annual)}
                    disabled={purchasingId !== null}
                  >
                    <LinearGradient
                      colors={['#7C3AED', '#EC4899']}
                      style={styles.planOptionGradient}
                    >
                      <View style={styles.planOptionHeader}>
                        <View style={styles.planOptionTitleWrap}>
                          <View style={styles.bestBadge}>
                            <Text style={styles.bestBadgeText}>MELHOR VALOR</Text>
                          </View>
                          <Text style={styles.planOptionTitleLight}>{annual.title}</Text>
                          <Text style={styles.planOptionSubtitleLight}>Renovação automática</Text>
                        </View>
                        <MaterialIcons name="workspace-premium" size={22} color="#FDE68A" />
                      </View>

                      <Text style={styles.planOptionPriceLight}>{annual.price}</Text>

                      {annual.introPrice && (
                        <Text style={styles.planOptionMetaLight}>
                          Oferta introdutória disponível
                        </Text>
                      )}

                      <Text style={styles.planOptionMetaLight}>
                        Cobrança recorrente conforme preço exibido pela loja
                      </Text>

                      <View style={styles.planOptionButtonLight}>
                        {purchasingId === annual.productId ? (
                          <ActivityIndicator size="small" color={Colors.Primary} />
                        ) : (
                          <>
                            <Text style={styles.planOptionButtonLightText}>Assinar anual</Text>
                            <MaterialIcons name="chevron-right" size={18} color={Colors.Primary} />
                          </>
                        )}
                      </View>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.emptyPlansBox}>
                <MaterialIcons name="subscriptions" size={22} color={Colors.TextMuted} />
                <Text style={styles.emptyPlansTitle}>Nenhum plano disponível</Text>
                <Text style={styles.emptyPlansText}>
                  Os planos só aparecem quando forem encontrados na loja.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.retryBtn, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => showPaywall('generic')}
                >
                  <Text style={styles.retryBtnText}>Tentar novamente</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── Trial CTA banner ── */}
        {isTrialActive && (
          <LinearGradient
            colors={['#D97706', '#B45309']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.trialBanner}
          >
            <MaterialIcons name="hourglass-top" size={18} color="#FEF3C7" />
            <View style={styles.trialBannerText}>
              <Text style={styles.trialBannerTitle}>{ts.trialBannerTitle}</Text>
              <Text style={styles.trialBannerSub}>
                {ts.trialBannerSub.replace('{{days}}', String(trialDaysLeft))}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.trialBannerBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => showPaywall('generic')}
            >
              <Text style={styles.trialBannerBtnText}>{ts.upgradeCta}</Text>
            </Pressable>
          </LinearGradient>
        )}

        {/* ── Features included ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isPro ? ts.yourBenefits : ts.whatsIncluded}
          </Text>
          <View style={styles.featuresBox}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={[
                  styles.featureIconWrap,
                  { backgroundColor: isPro ? Colors.Success + '22' : Colors.Primary + '18' },
                ]}>
                  <MaterialIcons
                    name={f.icon as any}
                    size={15}
                    color={isPro ? Colors.Success : Colors.Primary + 'AA'}
                  />
                </View>
                <Text style={[
                  styles.featureText,
                  !isPro && { color: Colors.TextMuted },
                ]}>
                  {ts[f.labelKey]}
                </Text>
                {!isPro && (
                  <View style={styles.lockChip}>
                    <MaterialIcons name="lock" size={10} color={Colors.TextMuted} />
                    <Text style={styles.lockChipText}>Pro</Text>
                  </View>
                )}
                {isPro && (
                  <MaterialIcons name="check" size={14} color={Colors.Success} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── Manage actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{ts.manageTitle}</Text>

          <View style={styles.actionsBox}>
            <Pressable
              style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleRestore}
              disabled={restoring}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.Primary + '18' }]}>
                {restoring
                  ? <ActivityIndicator size="small" color={Colors.Primary} />
                  : <MaterialIcons name="restore" size={19} color={Colors.Primary} />}
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>{ts.restorePurchases}</Text>
                <Text style={styles.actionSub}>{ts.restoreSub}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={Colors.TextMuted} />
            </Pressable>

            {isPro && !isExpired && (
              <>
                <View style={styles.actionDivider} />
                <Pressable
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.75 : 1 }]}
                  onPress={handleCancel}
                >
                  <View style={[styles.actionIcon, { backgroundColor: Colors.Error + '18' }]}>
                    <MaterialIcons name="cancel" size={19} color={Colors.Error} />
                  </View>
                  <View style={styles.actionBody}>
                    <Text style={[styles.actionTitle, { color: Colors.Error }]}>
                      {ts.cancelSubscription}
                    </Text>
                    <Text style={styles.actionSub}>{ts.cancelSub}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.Error + '88'} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ── Links legais ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL</Text>

          <View style={styles.actionsBox}>
            <Pressable
              style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={() => openUrl(PRIVACY_URL)}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.Primary + '18' }]}>
                <MaterialIcons name="privacy-tip" size={19} color={Colors.Primary} />
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>Política de Privacidade</Text>
                <Text style={styles.actionSub}>Abrir documento de privacidade</Text>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={Colors.TextMuted} />
            </Pressable>

            <View style={styles.actionDivider} />

            <Pressable
              style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={() => openUrl(TERMS_URL)}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.Primary + '18' }]}>
                <MaterialIcons name="gavel" size={19} color={Colors.Primary} />
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>Termos de Uso</Text>
                <Text style={styles.actionSub}>Abrir EULA / termos da assinatura</Text>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={Colors.TextMuted} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.legalNote}>
          A assinatura é renovada automaticamente, salvo cancelamento com pelo menos 24 horas antes do fim do período atual. O pagamento será cobrado na sua conta Apple ID ou Google Play na confirmação da compra. Você pode gerenciar ou cancelar sua assinatura nas configurações da loja.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.TextPrimary,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
  },
  planIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planInfo: { flex: 1 },
  planName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.TextPrimary,
    lineHeight: 26,
  },
  planSub: {
    fontSize: FontSize.xs,
    color: Colors.TextSubtle,
    marginTop: 4,
    lineHeight: 18,
  },
  subscriptionMeta: {
    fontSize: 11,
    color: Colors.TextMuted,
    marginTop: 4,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.Primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.Primary + '44',
  },
  proBadgeText: {
    color: Colors.Primary,
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  statusStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  statusBody: { flex: 1, gap: 4 },
  statusLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  trialCountdown: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  trialDays: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    lineHeight: 32,
  },
  trialDaysLabel: {
    fontSize: FontSize.xs,
    color: Colors.TextSubtle,
  },
  statusMeta: {
    fontSize: 11,
    color: Colors.TextMuted,
    marginTop: 2,
  },

  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  trialBannerText: { flex: 1 },
  trialBannerTitle: {
    color: '#FEF3C7',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  trialBannerSub: {
    color: 'rgba(254,243,199,0.8)',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  trialBannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  trialBannerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },

  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.TextMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  loadingBox: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.TextMuted,
    fontSize: FontSize.sm,
  },

  paywallStack: {
    gap: Spacing.md,
  },
  planOption: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  planOptionGradient: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  planOptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  planOptionTitleWrap: {
    flex: 1,
  },
  planOptionTitle: {
    color: Colors.TextPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  planOptionTitleLight: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  planOptionSubtitle: {
    color: Colors.TextMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  planOptionSubtitleLight: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  planOptionPrice: {
    color: Colors.TextPrimary,
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
  },
  planOptionPriceLight: {
    color: '#fff',
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
  },
  planOptionMeta: {
    color: Colors.TextMuted,
    fontSize: 11,
  },
  planOptionMetaLight: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
  },
  planOptionButton: {
    marginTop: 4,
    backgroundColor: Colors.Primary,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  planOptionButtonText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  planOptionButtonLight: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  planOptionButtonLightText: {
    color: Colors.Primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bestBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  emptyPlansBox: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyPlansTitle: {
    color: Colors.TextPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  emptyPlansText: {
    color: Colors.TextMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: Colors.Primary,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  featuresBox: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.TextPrimary,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  lockChipText: {
    color: Colors.TextMuted,
    fontSize: 9,
    fontWeight: FontWeight.semibold,
  },

  actionsBox: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1 },
  actionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.TextPrimary,
  },
  actionSub: {
    fontSize: 11,
    color: Colors.TextMuted,
    marginTop: 2,
  },
  actionDivider: {
    height: 1,
    backgroundColor: Colors.Border,
    marginLeft: 56,
  },

  legalNote: {
    fontSize: 10,
    color: Colors.TextMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
});