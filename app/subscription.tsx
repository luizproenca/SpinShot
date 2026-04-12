/**
 * SpinShot 360 — Subscription Management Screen
 * Accessible from Settings → Manage subscription
 * Shows: current plan, trial countdown, expiry date, restore, upgrade CTA
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { usePlan } from '../hooks/usePlan';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { formatExpiryDate, getTrialRemainingDays } from '../services/subscriptionService';

// ─── Feature list ─────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();
  const ts = (t as any).subscription as Record<string, string>;

  const {
    subscription,
    isPro,
    isTrial,
    subscriptionLoading,
    showPaywall,
    restorePurchases,
    cancelSubscription,
    refreshSubscription,
  } = usePlan();

  const [restoring, setRestoring]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isActive        = subscription.status === 'active';
  const isTrialActive   = subscription.status === 'trial';
  const isExpired       = subscription.status === 'expired' || subscription.status === 'cancelled';
  const isCancelled     = subscription.status === 'cancelled';

  const trialDaysLeft     = getTrialRemainingDays(subscription.trialStartAt);
  const expiryFormatted   = formatExpiryDate(subscription.expiresAt, language);

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
          {/* Plan icon */}
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
          </View>

          {/* Pro badge */}
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

            {/* Trial countdown */}
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

            {/* Trial ends on */}
            {isTrialActive && subscription.expiresAt && (
              <Text style={styles.statusMeta}>
                {ts.trialEndsOn}: {expiryFormatted}
              </Text>
            )}

            {/* Renews on (active, non-trial) */}
            {isActive && !isTrialActive && subscription.expiresAt && (
              <Text style={styles.statusMeta}>
                {ts.renewsOn}: {expiryFormatted}
              </Text>
            )}

            {/* Expired on */}
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

        {/* ── Upgrade CTA (free users) ── */}
        {!isPro && (
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            onPress={() => showPaywall('generic')}
          >
            <LinearGradient
              colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.upgradeCard}
            >
              <View style={styles.upgradeIconWrap}>
                <MaterialIcons name="star" size={24} color="#F59E0B" />
              </View>
              <View style={styles.upgradeTextWrap}>
                <Text style={styles.upgradeTitle}>{ts.upgradeCta}</Text>
                <Text style={styles.upgradeSub}>{ts.upgradeSub}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </Pressable>
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
            {/* Restore purchases */}
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

            {/* Cancel — only for active / trial Pro */}
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

        {/* ── Legal note ── */}
        <Text style={styles.legalNote}>{ts.legalNote}</Text>
      </ScrollView>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1, borderColor: Colors.Border,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.TextPrimary,
  },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Plan card
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
  },
  planIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
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
  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.Primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.Primary + '44',
  },
  proBadgeText: {
    color: Colors.Primary,
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  // Status strip
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
  trialCountdown: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
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

  // Trial banner
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

  // Upgrade CTA
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    shadowColor: Colors.Primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  upgradeIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  upgradeTextWrap: { flex: 1 },
  upgradeTitle: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  upgradeSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  // Section
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.TextMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Features
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
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.TextPrimary,
  },
  lockChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.Border,
  },
  lockChipText: {
    color: Colors.TextMuted,
    fontSize: 9,
    fontWeight: FontWeight.semibold,
  },

  // Actions
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
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
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
