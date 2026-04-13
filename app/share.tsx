import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Share, Animated,
  Platform, Dimensions, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { PRESET_CONFIGS, isVideoPreset, DEFAULT_PRESET } from '../services/videoEffectsService';
import { usePlan } from '../hooks/usePlan';
import { useLanguage } from '../hooks/useLanguage';

const AUTO_RETURN_DELAY = 12;

export default function ShareScreen() {
  const {
    shareUrl, eventName, eventColor, logoUrl, kioskMode, effect,
  } = useLocalSearchParams<{
    shareUrl: string;
    eventName: string;
    eventColor: string;
    logoUrl?: string;
    kioskMode?: string;
    effect?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { isPro, showPaywall } = usePlan();
  const { t } = useLanguage();

  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDimensions(window));
    return () => sub?.remove();
  }, []);

  const QR_SIZE = Math.min(dimensions.width - 80, 280);

  const url = shareUrl || 'https://spinshot360.app/v/demo';
  const accent = eventColor || Colors.Primary;
  const isKiosk = kioskMode === '1';

  const [autoCountdown, setAutoCountdown] = useState(AUTO_RETURN_DELAY);
  const [copied, setCopied] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const qrGlow = useRef(new Animated.Value(0.4)).current;
  const qrScale = useRef(new Animated.Value(0.92)).current;
  const autoProgressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(qrScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(qrGlow, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(qrGlow, { toValue: 0.35, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    if (isKiosk) {
      Animated.timing(autoProgressAnim, {
        toValue: 0,
        duration: AUTO_RETURN_DELAY * 1000,
        useNativeDriver: false,
      }).start();

      const interval = setInterval(() => {
        setAutoCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            router.replace('/(tabs)');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, []);

  const haptic = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, []);

  const handleCopy = useCallback(async () => {
    await haptic();
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [url]);

  // Real WhatsApp share with deep link
  const handleWhatsApp = useCallback(async () => {
    await haptic();
    const message = encodeURIComponent(
      `🎥 Veja meu vídeo 360° do SpinShot!\n${url}`
    );
    const whatsappUrl = `whatsapp://send?text=${message}`;
    const webUrl = `https://wa.me/?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback: native share sheet
        await Share.share({
          message: `🎥 Veja meu vídeo 360° do SpinShot!\n${url}`,
          url: url,
          title: 'SpinShot 360',
        });
      }
    } catch {
      // Last fallback: copy link
      await handleCopy();
      showAlert('Link copiado', 'Cole no WhatsApp para compartilhar.');
    }
  }, [url, handleCopy]);

  // Native system share
  const handleNativeShare = useCallback(async () => {
    await haptic();
    try {
      await Share.share({
        message: `🎥 Veja meu vídeo SpinShot 360!\n${url}`,
        url: url,
        title: 'SpinShot 360',
      });
    } catch {}
  }, [url]);

  const autoProgressWidth = autoProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient
      colors={['#0D0820', '#0A0F2E', '#0D0820']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Ambient orbs */}
      <View style={[styles.ambientOrb, styles.orb1, { backgroundColor: accent }]} />
      <View style={[styles.ambientOrb, styles.orb2]} />

      <Animated.View style={[styles.screen, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ─── Header ─── */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={18} color={Colors.TextSubtle} />
          </Pressable>

          <View style={[styles.eventChip, { borderColor: accent + '55' }]}>
            <View style={[styles.eventDot, { backgroundColor: accent }]} />
            <Text style={styles.eventText} numberOfLines={1}>{eventName}</Text>
          </View>

          {/* Native share button */}
          <Pressable
            style={({ pressed }) => [styles.nativeShareBtn, { opacity: pressed ? 0.75 : 1 }]}
            onPress={handleNativeShare}
            hitSlop={8}
          >
            <MaterialIcons name="ios-share" size={18} color={Colors.TextSubtle} />
          </Pressable>
        </View>

        {/* ─── Title ─── */}
        <Text style={styles.headline}>{t.share.headline}</Text>

        {/* ─── QR CODE ─── */}
        <View style={styles.qrSection}>
          <Animated.View
            style={[
              styles.qrHalo,
              { opacity: qrGlow, shadowColor: accent, width: QR_SIZE + 64, height: QR_SIZE + 64 },
            ]}
          />

          <Animated.View
            style={[
              styles.qrFrame,
              { borderColor: accent + '66', transform: [{ scale: qrScale }] },
            ]}
          >
            {/* Corner decorators */}
            {[
              { key: 'TL', top: -2, left: -2, style: styles.cornerTL },
              { key: 'TR', top: -2, right: -2, style: styles.cornerTR },
              { key: 'BL', bottom: -2, left: -2, style: styles.cornerBL },
              { key: 'BR', bottom: -2, right: -2, style: styles.cornerBR },
            ].map(c => (
              <View
                key={c.key}
                style={[
                  styles.corner,
                  { borderColor: accent },
                  c.style,
                  c.top !== undefined ? { top: c.top } : { bottom: c.bottom },
                  c.left !== undefined ? { left: c.left } : { right: c.right },
                ]}
              />
            ))}

            <View style={styles.qrWhiteBg}>
              <QRCode
                value={url}
                size={QR_SIZE}
                color="#1A1740"
                backgroundColor="#FFFFFF"
                logo={logoUrl ? { uri: logoUrl } : undefined}
                logoSize={logoUrl ? Math.round(QR_SIZE * 0.22) : undefined}
                logoBackgroundColor="#FFFFFF"
                logoMargin={logoUrl ? 4 : undefined}
                logoBorderRadius={logoUrl ? 8 : undefined}
              />
            </View>
          </Animated.View>
        </View>

        {/* Effect badge — dynamic from route param */}
        <View style={styles.effectRow}>
          {(() => {
            const preset = isVideoPreset(effect) ? effect : DEFAULT_PRESET;
            const presetInfo = PRESET_CONFIGS[preset];
            return (
              <View style={styles.effectBadge}>
                <Text style={styles.effectBadgeEmoji}>{presetInfo.emoji}</Text>
                <Text style={styles.effectBadgeText}>{presetInfo.label}</Text>
              </View>
            );
          })()}
        </View>

        <Text style={styles.qrHint}>{t.share.hint}</Text>

        {/* ─── Share Actions ─── */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.waBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleWhatsApp}
          >
            <MaterialIcons name="chat" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>{t.share.whatsapp}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.copyBtn,
              {
                borderColor: copied ? Colors.Success : accent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={handleCopy}
          >
            <MaterialIcons
              name={copied ? 'check-circle' : 'content-copy'}
              size={20}
              color={copied ? Colors.Success : accent}
            />
            <Text style={[styles.actionBtnText, { color: copied ? Colors.Success : accent }]}>
              {copied ? t.share.copied : t.share.copyLink}
            </Text>
          </Pressable>
        </View>

        {/* ─── Upsell strip (free users only) ─── */}
        {!isPro && !isKiosk && (
          <Pressable
            onPress={() => showPaywall('watermark')}
            style={({ pressed }) => [styles.upsellStrip, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={['#7C3AED18', '#EC489918']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.upsellGrad}
            >
              <MaterialIcons name="hide-source" size={15} color={Colors.Primary} />
              <Text style={styles.upsellText}>{t.share.upsellText}</Text>
              <View style={styles.upsellBtn}>
                <Text style={styles.upsellBtnText}>{t.share.seePlans}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* ─── Kiosk Auto Return ─── */}
        {isKiosk && (
          <View style={styles.autoBlock}>
            <View style={styles.autoTrack}>
              <Animated.View
                style={[
                  styles.autoFill,
                  { width: autoProgressWidth, backgroundColor: accent },
                ]}
              />
            </View>
            <View style={styles.autoRow}>
              <Text style={styles.autoLabel}>
                {t.share.autoReturn}{' '}
                <Text style={[styles.autoCount, { color: accent }]}>{autoCountdown}s</Text>
              </Text>
              <Pressable
                style={({ pressed }) => [styles.recordNowBtn, { opacity: pressed ? 0.75 : 1 }]}
                onPress={() => router.replace('/(tabs)')}
              >
                <MaterialIcons name="videocam" size={14} color={accent} />
                <Text style={[styles.recordNowText, { color: accent }]}>{t.share.recordNow}</Text>
              </Pressable>
            </View>
          </View>
        )}

      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  ambientOrb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 240, height: 240, top: -40, right: -80, opacity: 0.08 },
  orb2: { width: 180, height: 180, backgroundColor: '#3B82F6', bottom: 60, left: -50, opacity: 0.06 },

  screen: { flex: 1, paddingHorizontal: Spacing.lg, gap: Spacing.lg, justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderWidth: 1, borderColor: Colors.Border,
  },
  nativeShareBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderWidth: 1, borderColor: Colors.Border,
  },
  eventChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: Colors.SurfaceElevated,
  },
  eventDot: { width: 7, height: 7, borderRadius: 4 },
  eventText: { color: Colors.TextSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.medium, maxWidth: 160 },

  // Title
  headline: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold,
    color: Colors.TextPrimary, textAlign: 'center', lineHeight: 34,
  },

  // QR Section
  qrSection: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  qrHalo: {
    position: 'absolute', borderRadius: Radius.xl + 10,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1,
    shadowRadius: 40, elevation: 24, backgroundColor: 'transparent',
  },
  qrFrame: {
    borderRadius: Radius.xl, borderWidth: 2,
    position: 'relative', padding: 6,
    backgroundColor: Colors.SurfaceElevated,
  },
  qrWhiteBg: {
    backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16,
  },

  // Corner accents
  corner: { position: 'absolute', width: 22, height: 22, borderWidth: 3 },
  cornerTL: { borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: Radius.sm },
  cornerTR: { borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: Radius.sm },
  cornerBL: { borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: Radius.sm },
  cornerBR: { borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: Radius.sm },

  effectRow: { alignItems: 'center' },
  effectBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.Primary + '18', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.Primary + '44',
    paddingHorizontal: 14, paddingVertical: 6,
  },
  effectBadgeEmoji: { fontSize: 14 },
  effectBadgeText: { color: Colors.Primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  qrHint: { textAlign: 'center', color: Colors.TextSubtle, fontSize: FontSize.sm },

  // Actions
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, height: 52, borderRadius: Radius.full,
  },
  waBtn: { backgroundColor: '#25D366' },
  copyBtn: { borderWidth: 1.5, backgroundColor: Colors.SurfaceElevated },
  actionBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Upsell strip
  upsellStrip: { borderRadius: Radius.lg, overflow: 'hidden' },
  upsellGrad: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.Primary + '33',
  },
  upsellText: { flex: 1, color: Colors.TextSubtle, fontSize: FontSize.xs, lineHeight: 18 },
  upsellBtn: {
    backgroundColor: Colors.Primary, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  upsellBtnText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },

  // Auto return
  autoBlock: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border, overflow: 'hidden',
  },
  autoTrack: { height: 3, backgroundColor: Colors.Border },
  autoFill: { height: 3 },
  autoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  autoLabel: { flex: 1, color: Colors.TextMuted, fontSize: FontSize.xs },
  autoCount: { fontWeight: FontWeight.bold },
  recordNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recordNowText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
