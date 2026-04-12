import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  FlatList, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { usePlan } from '../hooks/usePlan';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDE_GRADIENTS: [string, string][] = [
  ['#7C3AED', '#4F46E5'],
  ['#4F46E5', '#0EA5E9'],
  ['#EC4899', '#7C3AED'],
];
const SLIDE_EMOJIS = ['🎥', '📲', '🎉'];
const SLIDE_ACCENTS = ['#C084FC', '#38BDF8', '#F9A8D4'];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { markOnboardingSeen } = usePlan();
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  const SLIDES = [
    { id: '1', emoji: SLIDE_EMOJIS[0], gradient: SLIDE_GRADIENTS[0], title: t.onboarding.slide1Title, subtitle: t.onboarding.slide1Sub, accent: SLIDE_ACCENTS[0] },
    { id: '2', emoji: SLIDE_EMOJIS[1], gradient: SLIDE_GRADIENTS[1], title: t.onboarding.slide2Title, subtitle: t.onboarding.slide2Sub, accent: SLIDE_ACCENTS[1] },
    { id: '3', emoji: SLIDE_EMOJIS[2], gradient: SLIDE_GRADIENTS[2], title: t.onboarding.slide3Title, subtitle: t.onboarding.slide3Sub, accent: SLIDE_ACCENTS[2] },
  ];
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const haptic = () => {
    if (Platform.OS !== 'web') {
      try { Haptics.selectionAsync(); } catch {}
    }
  };

  const goNext = () => {
    haptic();
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      handleStart();
    }
  };

  const handleStart = async () => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const onBtnIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const onBtnOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const isLast = currentIndex === SLIDES.length - 1;
  const slide = SLIDES[currentIndex];

  return (
    <LinearGradient
      colors={['#0D0820', '#0A0F2E', '#0D0820']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

        {/* Skip */}
        <View style={styles.topBar}>
          <View />
          {!isLast && (
            <Pressable onPress={handleStart} hitSlop={12}>
              <Text style={styles.skipText}>{t.onboarding.skip}</Text>
            </Pressable>
          )}
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width: SCREEN_W }]}>
              {/* Illustration orb */}
              <View style={styles.illustrationWrap}>
                <LinearGradient
                  colors={[item.gradient[0] + '33', item.gradient[1] + '11']}
                  style={styles.orbOuter}
                />
                <LinearGradient
                  colors={item.gradient}
                  style={styles.orbInner}
                >
                  <Text style={styles.slideEmoji}>{item.emoji}</Text>
                </LinearGradient>
              </View>

              {/* Text */}
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          )}
        />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                i === currentIndex
                  ? { backgroundColor: slide.accent, width: 24 }
                  : { backgroundColor: Colors.Border, width: 8 },
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaArea}>
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              onPressIn={onBtnIn}
              onPressOut={onBtnOut}
              onPress={goNext}
            >
              <LinearGradient
                colors={slide.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                <Text style={styles.ctaBtnText}>
                  {isLast ? t.onboarding.start : t.onboarding.next}
                </Text>
                <MaterialIcons
                  name={isLast ? 'rocket-launch' : 'arrow-forward'}
                  size={20}
                  color="#fff"
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {isLast && (
            <Text style={styles.noCardText}>{t.onboarding.noCard}</Text>
          )}
        </View>

      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: Spacing.lg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  skipText: { color: Colors.TextSubtle, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },

  illustrationWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  orbOuter: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
  },
  orbInner: {
    width: 180, height: 180, borderRadius: 90,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 30, elevation: 20,
  },
  slideEmoji: { fontSize: 72 },

  slideTitle: {
    fontSize: FontSize.xxl + 4, fontWeight: FontWeight.extrabold,
    color: Colors.TextPrimary, textAlign: 'center', lineHeight: 38,
    letterSpacing: 0.2,
  },
  slideSubtitle: {
    fontSize: FontSize.md, color: Colors.TextSubtle,
    textAlign: 'center', lineHeight: 26,
  },

  dotsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, marginVertical: Spacing.lg,
  },
  dot: { height: 8, borderRadius: 4 },

  ctaArea: { gap: Spacing.md, marginBottom: Spacing.lg },
  ctaBtn: {
    height: 60, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 12,
  },
  ctaBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  noCardText: { color: Colors.TextMuted, fontSize: FontSize.xs, textAlign: 'center' },
});
