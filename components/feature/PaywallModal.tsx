import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  Modal, Platform, ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlan } from '../../hooks/usePlan';
import { useLanguage } from '../../hooks/useLanguage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { PRODUCT_DETAILS, getCurrentPlatform } from '../../services/subscriptionService';
import type { IAPProductId, PlanContextType } from '../../contexts/PlanContext';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.min(SCREEN_H * 0.94, 740);

// ─── Feature lists ──────────────────────────────────────────────────────────

const FREE_LIMITS = [
  { icon: 'event', label: 'events_limit' },
  { icon: 'replay', label: 'effect_boomerang' },
  { icon: 'layers', label: 'free_frames' },
  { icon: 'music-note', label: 'free_music' },
  { icon: 'share', label: 'share_video' },
];

const FREE_BLOCKS = [
  { icon: 'branding-watermark', label: 'watermark_block' },
  { icon: 'hd-outlined', label: 'quality_block' },
  { icon: 'timer-off', label: 'duration_block' },
  { icon: 'lock', label: 'cinematic_block' },
  { icon: 'lock', label: 'hype_block' },
  { icon: 'image-not-supported', label: 'frame_upload_block' },
  { icon: 'no-photography', label: 'logo_block' },
];

const PRO_FEATURES = [
  { icon: 'hide-source', labelKey: 'feature_no_watermark' },
  { icon: 'hd', labelKey: 'feature_fullhd' },
  { icon: 'all-inclusive', labelKey: 'feature_unlimited_events' },
  { icon: 'timer', labelKey: 'feature_long_videos' },
  { icon: 'auto-awesome', labelKey: 'feature_all_effects' },
  { icon: 'layers', labelKey: 'feature_premium_frames' },
  { icon: 'music-note', labelKey: 'feature_premium_music' },
  { icon: 'add-photo-alternate', labelKey: 'feature_frame_upload' },
  { icon: 'business', labelKey: 'feature_event_logo' },
];

// ─── Trigger messages ────────────────────────────────────────────────────────

interface TriggerInfo { icon: string; title: string; subtitle: string }

const TRIGGER_MESSAGES: Record<string, (t: any) => TriggerInfo> = {
  watermark:       t => ({ icon: 'hide-source',        title: t.paywall.trigger_watermark_title,    subtitle: t.paywall.trigger_watermark_sub }),
  hd:              t => ({ icon: 'hd',                 title: t.paywall.trigger_hd_title,           subtitle: t.paywall.trigger_hd_sub }),
  cinematic:       t => ({ icon: 'movie-creation',     title: t.paywall.trigger_cinematic_title,    subtitle: t.paywall.trigger_cinematic_sub }),
  hype:            t => ({ icon: 'bolt',               title: t.paywall.trigger_hype_title,         subtitle: t.paywall.trigger_hype_sub }),
  event_limit:     t => ({ icon: 'event-busy',         title: t.paywall.trigger_event_limit_title,  subtitle: t.paywall.trigger_event_limit_sub }),
  duration:        t => ({ icon: 'timer-off',          title: t.paywall.trigger_duration_title,     subtitle: t.paywall.trigger_duration_sub }),
  premium_frame:   t => ({ icon: 'layers',             title: t.paywall.trigger_frame_title,        subtitle: t.paywall.trigger_frame_sub }),
  premium_music:   t => ({ icon: 'library-music',      title: t.paywall.trigger_music_title,        subtitle: t.paywall.trigger_music_sub }),
  frame_upload:    t => ({ icon: 'add-photo-alternate',title: t.paywall.trigger_frame_upload_title, subtitle: t.paywall.trigger_frame_upload_sub }),
  event_logo:      t => ({ icon: 'business',           title: t.paywall.trigger_logo_title,         subtitle: t.paywall.trigger_logo_sub }),
  generic:         t => ({ icon: 'star',               title: t.paywall.trigger_generic_title,      subtitle: t.paywall.trigger_generic_sub }),
};

// ─── Price Skeleton ──────────────────────────────────────────────────────────

function PriceSkeleton({ selected }: { selected: boolean }) {
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const bg = selected ? 'rgba(255,255,255,0.25)' : Colors.SurfaceElevated;

  return (
    <View style={styles.priceRow}>
      <Animated.View style={[styles.skeletonPrice, { backgroundColor: bg, opacity: pulse }]} />
      <Animated.View style={[styles.skeletonPeriod, { backgroundColor: bg, opacity: pulse }]} />
    </View>
  );
}

// ─── Plan Card ───────────────────────────────────────────────────────────────

function PlanCard({
  productId,
  isSelected,
  onSelect,
  scaleAnim,
  t,
  rcPrice,
  loading,
}: {
  productId: IAPProductId;
  isSelected: boolean;
  onSelect: () => void;
  scaleAnim: Animated.Value;
  t: any;
  rcPrice?: string;
  loading?: boolean;
}) {
  const product = PRODUCT_DETAILS[productId];
  const isAnnual = productId === 'spinshot_pro_annual';

  // RC live price takes precedence; static fallback shown until RC loads
  const displayPrice = rcPrice ?? product.priceLocal;

  return (
    <Animated.View style={[
      styles.planCardWrap,
      isSelected && styles.planCardWrapSelected,
      { transform: [{ scale: scaleAnim }] },
    ]}>
      <Pressable onPress={onSelect} style={{ flex: 1 }}>
        {isSelected && (
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        {!isSelected && (
          <LinearGradient colors={['#1A1740', '#12103A']} style={StyleSheet.absoluteFillObject} />
        )}

        <View style={styles.planCardContent}>
          {isAnnual && (
            <View style={styles.bestValueBadge}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.bestValueGrad}>
                <Text style={styles.bestValueText}>{t.paywall.best_value}</Text>
              </LinearGradient>
            </View>
          )}

          {!isAnnual && (
            <View style={styles.popularBadge}>
              <LinearGradient colors={['#F59E0B', '#EF4444']} style={styles.popularBadgeGrad}>
                <Text style={styles.popularBadgeText}>⭐ {t.paywall.most_popular}</Text>
              </LinearGradient>
            </View>
          )}

          <Text style={[styles.planName, isSelected && { color: '#fff' }]}>
            {isAnnual ? t.paywall.annual_label : t.paywall.monthly_label}
          </Text>

          {/* Skeleton while RC prices are loading, real price once ready */}
          {loading ? (
            <PriceSkeleton selected={isSelected} />
          ) : (
            <View style={styles.priceRow}>
              <Text style={[styles.priceValue, isSelected && { color: '#fff' }]}>
                {displayPrice}
              </Text>
              <Text style={[styles.pricePeriod, isSelected && { color: 'rgba(255,255,255,0.75)' }]}>
                {product.period}
              </Text>
            </View>
          )}

          {isAnnual && (
            <View style={styles.trialBadge}>
              <MaterialIcons name="celebration" size={12} color={isSelected ? '#fff' : Colors.Success} />
              <Text style={[styles.trialBadgeText, isSelected && { color: '#fff' }]}>
                {t.paywall.trial_badge}
              </Text>
            </View>
          )}

          {/* For monthly: show intl fallback when no RC price, hide when RC price is shown */}
          {!isAnnual && !loading && !rcPrice && (
            <Text style={[styles.priceIntl, isSelected && { color: 'rgba(255,255,255,0.6)' }]}>
              {product.priceIntl}
            </Text>
          )}

          {isSelected && (
            <View style={styles.selectedCheck}>
              <MaterialIcons name="check-circle" size={20} color="#fff" />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Paywall Modal ──────────────────────────────────────────────────────

export default function PaywallModal() {
  const {
    isPaywallVisible, hidePaywall, paywallTrigger,
    purchasePlan, restorePurchases,
    rcPackages, rcPackagesLoading,
  } = usePlan() as PlanContextType & { rcPackages: any[]; rcPackagesLoading: boolean };
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [selectedProduct, setSelectedProduct] = useState<IAPProductId>('spinshot_pro_annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const monthlyScale = useRef(new Animated.Value(1)).current;
  const annualScale = useRef(new Animated.Value(1)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(false);

  const triggerFn = TRIGGER_MESSAGES[paywallTrigger] ?? TRIGGER_MESSAGES.generic;
  const triggerInfo = triggerFn(t);

  // Helper: find RC package by product identifier, also check RevenueCat default identifiers
  const findRcPrice = useCallback((productId: IAPProductId): string | undefined => {
    const rcId = productId === 'spinshot_pro_monthly' ? '$rc_monthly' : '$rc_annual';
    const pkg = rcPackages.find(
      p => p.productIdentifier === productId || p.identifier === rcId
    );
    return pkg?.priceString;
  }, [rcPackages]);

  useEffect(() => {
    if (isPaywallVisible) {
      setMounted(true);
      setSelectedProduct('spinshot_pro_annual');
      setResultMsg(null);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_H, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => { setMounted(false); setResultMsg(null); });
    }
  }, [isPaywallVisible]);

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, []);

  const selectProduct = useCallback((id: IAPProductId) => {
    haptic();
    setSelectedProduct(id);
    const target = id === 'spinshot_pro_monthly' ? monthlyScale : annualScale;
    Animated.sequence([
      Animated.spring(target, { toValue: 1.04, useNativeDriver: true, speed: 60 }),
      Animated.spring(target, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    Animated.sequence([
      Animated.spring(ctaScale, { toValue: 0.96, useNativeDriver: true }),
      Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    setPurchasing(true);
    setResultMsg(null);

    const platform = getCurrentPlatform();
    const result = await purchasePlan(selectedProduct, platform);

    setPurchasing(false);

    if (result.success) {
      const successText = result.isTrial
        ? t.paywall.trial_started_msg
        : t.paywall.subscription_active_msg;
      setResultMsg({ type: 'success', text: successText });
      setTimeout(() => { hidePaywall(); setResultMsg(null); }, 1800);
    } else {
      setResultMsg({ type: 'error', text: result.error || t.paywall.purchase_error });
    }
  }, [selectedProduct, purchasePlan, hidePaywall, t]);

  const handleRestore = useCallback(async () => {
    haptic();
    setRestoring(true);
    setResultMsg(null);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.success) {
      if (result.restored) {
        setResultMsg({ type: 'success', text: t.paywall.restore_success });
        setTimeout(() => hidePaywall(), 1500);
      } else {
        setResultMsg({ type: 'error', text: t.paywall.restore_not_found });
      }
    } else {
      setResultMsg({ type: 'error', text: t.paywall.restore_error });
    }
  }, [haptic, restorePurchases, hidePaywall, t]);

  if (!mounted && !isPaywallVisible) return null;

  const isProcessing = purchasing || restoring;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={hidePaywall}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={hidePaywall} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[
        styles.sheet,
        {
          height: SHEET_H + insets.bottom,
          paddingBottom: insets.bottom + Spacing.md,
          transform: [{ translateY: slideAnim }],
        },
      ]}>
        <View style={styles.sheetHandle} />

        <Pressable style={styles.closeBtn} onPress={hidePaywall} hitSlop={12}>
          <MaterialIcons name="close" size={18} color={Colors.TextSubtle} />
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── Trigger badge ── */}
          <View style={styles.triggerBadge}>
            <MaterialIcons name={triggerInfo.icon as any} size={15} color={Colors.Warning} />
            <Text style={styles.triggerText}>{triggerInfo.subtitle}</Text>
          </View>

          {/* ── Hero ── */}
          <LinearGradient colors={['#7C3AED22', '#EC489922', '#7C3AED00']} style={styles.hero}>
            <Text style={styles.heroEmoji}>⚡</Text>
            <Text style={styles.heroTitle}>{t.paywall.hero_title}</Text>
            <Text style={styles.heroSub}>{t.paywall.hero_sub}</Text>
          </LinearGradient>

          {/* ── Annual trial banner ── */}
          <View style={styles.trialBannerOuter}>
            <LinearGradient colors={['#10B98122', '#7C3AED22']} style={styles.trialBannerGrad}>
              <MaterialIcons name="celebration" size={16} color={Colors.Success} />
              <Text style={styles.trialBannerText}>{t.paywall.trial_banner}</Text>
            </LinearGradient>
          </View>

          {/* ── Plan Cards — prices from RC SDK or static fallback ── */}
          <View style={styles.plansRow}>
            <PlanCard
              productId="spinshot_pro_monthly"
              isSelected={selectedProduct === 'spinshot_pro_monthly'}
              onSelect={() => selectProduct('spinshot_pro_monthly')}
              scaleAnim={monthlyScale}
              t={t}
              loading={rcPackagesLoading}
              rcPrice={findRcPrice('spinshot_pro_monthly')}
            />
            <PlanCard
              productId="spinshot_pro_annual"
              isSelected={selectedProduct === 'spinshot_pro_annual'}
              onSelect={() => selectProduct('spinshot_pro_annual')}
              scaleAnim={annualScale}
              t={t}
              loading={rcPackagesLoading}
              rcPrice={findRcPrice('spinshot_pro_annual')}
            />
          </View>

          {/* ── Feature list ── */}
          <View style={styles.featuresBox}>
            <Text style={styles.featuresTitle}>{t.paywall.included_title}</Text>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <MaterialIcons name={f.icon as any} size={14} color={Colors.Success} />
                </View>
                <Text style={styles.featureText}>{(t.paywall as any)[f.labelKey]}</Text>
              </View>
            ))}
          </View>

          {/* ── Result message ── */}
          {resultMsg ? (
            <View style={[
              styles.resultMsg,
              {
                backgroundColor: resultMsg.type === 'success' ? Colors.Success + '22' : Colors.Error + '22',
                borderColor:     resultMsg.type === 'success' ? Colors.Success + '55' : Colors.Error + '55',
              },
            ]}>
              <MaterialIcons
                name={resultMsg.type === 'success' ? 'check-circle' : 'error-outline'}
                size={16}
                color={resultMsg.type === 'success' ? Colors.Success : Colors.Error}
              />
              <Text style={[
                styles.resultMsgText,
                { color: resultMsg.type === 'success' ? Colors.Success : Colors.Error },
              ]}>
                {resultMsg.text}
              </Text>
            </View>
          ) : null}

          {/* ── Main CTA ── */}
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <Pressable onPress={handleSubscribe} disabled={isProcessing}>
              <LinearGradient
                colors={['#C084FC', '#8B5CF6', '#4F46E5']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.ctaBtn, isProcessing && { opacity: 0.75 }]}
              >
                {purchasing ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.ctaBtnText}>{t.paywall.processing}</Text>
                  </>
                ) : rcPackagesLoading ? (
                  <>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                    <Text style={[styles.ctaBtnText, { opacity: 0.8 }]}>{t.common.loading}</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="star" size={20} color="#fff" />
                    <Text style={styles.ctaBtnText}>
                      {selectedProduct === 'spinshot_pro_annual'
                        ? t.paywall.cta_annual
                        : t.paywall.cta_monthly}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Text style={styles.cancelNote}>{t.paywall.cancel_note}</Text>

          {/* ── Free plan info ── */}
          <View style={styles.freePlanBox}>
            <Text style={styles.freePlanTitle}>{t.paywall.free_plan_title}</Text>
            <View style={styles.freePlanRow}>
              <View style={styles.freePlanAllowed}>
                <Text style={styles.freePlanSectionLabel}>{t.paywall.free_allowed}</Text>
                {FREE_LIMITS.map((f, i) => (
                  <View key={i} style={styles.miniFeatureRow}>
                    <MaterialIcons name={f.icon as any} size={12} color={Colors.TextSubtle} />
                    <Text style={styles.miniFeatureText}>{(t.paywall as any)['free_' + f.label]}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.freePlanBlocked}>
                <Text style={[styles.freePlanSectionLabel, { color: Colors.Error }]}>{t.paywall.free_blocked}</Text>
                {FREE_BLOCKS.slice(0, 4).map((f, i) => (
                  <View key={i} style={styles.miniFeatureRow}>
                    <MaterialIcons name="lock" size={11} color={Colors.Error + '88'} />
                    <Text style={[styles.miniFeatureText, { color: Colors.TextMuted }]}>{(t.paywall as any)['free_' + f.label]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* ── Restore ── */}
          <Pressable
            onPress={handleRestore}
            disabled={isProcessing}
            style={({ pressed }) => [styles.restoreBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            {restoring
              ? <ActivityIndicator size="small" color={Colors.TextMuted} />
              : <Text style={styles.restoreText}>{t.paywall.restore_purchases}</Text>}
          </Pressable>

          <Text style={styles.legalNote}>{t.paywall.legal_note}</Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,5,15,0.82)' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#13112E',
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.Border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6, shadowRadius: 30, elevation: 30,
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: Colors.Border, marginTop: 12, marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute', top: 20, right: Spacing.lg, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderWidth: 1, borderColor: Colors.Border,
  },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.lg },

  triggerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    backgroundColor: Colors.Warning + '18',
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.Warning + '33',
  },
  triggerText: { color: Colors.Warning, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  hero: {
    alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.md, borderRadius: Radius.xl,
  },
  heroEmoji: { fontSize: 32 },
  heroTitle: {
    fontSize: FontSize.xl, fontWeight: FontWeight.extrabold,
    color: Colors.TextPrimary, textAlign: 'center', lineHeight: 28,
  },
  heroSub: { fontSize: FontSize.sm, color: Colors.TextSubtle, textAlign: 'center', lineHeight: 20 },

  trialBannerOuter: { borderRadius: Radius.lg, overflow: 'hidden' },
  trialBannerGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.Success + '33', borderRadius: Radius.lg,
  },
  trialBannerText: { color: Colors.Success, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1, lineHeight: 20 },

  plansRow: { flexDirection: 'row', gap: Spacing.sm },

  // Skeleton shapes
  skeletonPrice: {
    height: 22, width: 78,
    borderRadius: 6,
    marginRight: 4,
  },
  skeletonPeriod: {
    height: 12, width: 28,
    borderRadius: 4,
    alignSelf: 'flex-end',
    marginBottom: 3,
  },

  planCardWrap: {
    flex: 1, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: Colors.Border,
    overflow: 'hidden', minHeight: 160,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  planCardWrapSelected: {
    borderColor: Colors.Primary,
    shadowColor: Colors.Primary, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16,
  },
  planCardContent: { padding: Spacing.md, gap: 6, flex: 1 },

  bestValueBadge: { alignSelf: 'flex-start', borderRadius: Radius.full, overflow: 'hidden', marginBottom: 2 },
  bestValueGrad: { paddingHorizontal: 9, paddingVertical: 3 },
  bestValueText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5 },

  popularBadge: { alignSelf: 'flex-start', borderRadius: Radius.full, overflow: 'hidden', marginBottom: 2 },
  popularBadgeGrad: { paddingHorizontal: 9, paddingVertical: 3 },
  popularBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },

  planName: { color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  priceValue: { color: Colors.TextPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, lineHeight: 28 },
  pricePeriod: { color: Colors.TextSubtle, fontSize: 10, paddingBottom: 3 },
  priceIntl: { color: Colors.TextMuted, fontSize: 10 },

  trialBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.Success + '18', borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.Success + '33',
    alignSelf: 'flex-start', marginTop: 2,
  },
  trialBadgeText: { color: Colors.Success, fontSize: 9, fontWeight: FontWeight.semibold },

  selectedCheck: { position: 'absolute', top: 10, right: 10 },

  featuresBox: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.Border,
    padding: Spacing.md, gap: 8,
  },
  featuresTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.TextMuted, textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.Success + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { color: Colors.TextSecondary, fontSize: FontSize.xs, flex: 1, lineHeight: 17 },

  resultMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  resultMsgText: { flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.medium, lineHeight: 18 },

  ctaBtn: {
    height: 62, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 12,
  },
  ctaBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  cancelNote: { textAlign: 'center', color: Colors.TextMuted, fontSize: FontSize.xs },

  freePlanBox: {
    backgroundColor: Colors.Surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.Border, padding: Spacing.md, gap: Spacing.sm,
  },
  freePlanTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.TextMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  freePlanRow: { flexDirection: 'row', gap: Spacing.md },
  freePlanAllowed: { flex: 1, gap: 5 },
  freePlanBlocked: { flex: 1, gap: 5 },
  freePlanSectionLabel: {
    fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.TextSubtle,
    marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  miniFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniFeatureText: { color: Colors.TextSubtle, fontSize: 10, flex: 1, lineHeight: 15 },

  restoreBtn: { alignSelf: 'center', padding: 4 },
  restoreText: { color: Colors.TextMuted, fontSize: FontSize.xs, textDecorationLine: 'underline' },

  legalNote: { textAlign: 'center', color: Colors.TextMuted, fontSize: 9, lineHeight: 14 },
});
