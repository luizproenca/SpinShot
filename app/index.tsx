import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { usePlan } from '../hooks/usePlan';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const { hasSeenOnboarding } = usePlan();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(gradientAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();

    const timer = setTimeout(() => {
      if (!isLoading) {
        if (user) {
          router.replace('/(tabs)');
        } else if (!hasSeenOnboarding) {
          router.replace('/onboarding');
        } else {
          router.replace('/(auth)/login');
        }
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isLoading, user]);

  return (
    <LinearGradient
      colors={['#1A0533', '#0D1B4A', '#2D0A4E', '#0D1B4A', '#1A0533']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
          transition={300}
        />

        <Text style={styles.appName}>SpinShot 360</Text>
        <Text style={styles.tagline}>{t.splash.tagline}</Text>

        <View style={styles.dotsRow}>
          {[Colors.Primary, Colors.Secondary, Colors.Accent].map((c, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: c }]} />
          ))}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.splash.powered}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.Primary,
    opacity: 0.12,
    top: -80,
    left: -80,
  },
  orb2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.Accent,
    opacity: 0.1,
    bottom: 60,
    right: -60,
  },
  orb3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.Secondary,
    opacity: 0.1,
    bottom: 200,
    left: -40,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: Spacing.sm,
  },
  appName: {
    fontSize: 38,
    fontWeight: FontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
  },
  tagline: {
    fontSize: FontSize.lg,
    color: Colors.TextSecondary,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: Spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    color: Colors.TextMuted,
    fontSize: FontSize.xs,
  },
});
