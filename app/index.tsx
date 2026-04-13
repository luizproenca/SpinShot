import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { usePlan } from '../hooks/usePlan';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Particle config ──────────────────────────────────────────────────────────

interface ParticleConfig {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;        // horizontal drift for floating
  floatRange: number;   // vertical float range
}

const STAR_COLORS = [
  '#FFFFFF',
  '#C084FC',  // purple-400
  '#818CF8',  // indigo-400
  '#F472B6',  // pink-400
  '#60A5FA',  // blue-400
  '#A78BFA',  // violet-400
];

function buildParticles(count: number): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: Math.random() * SCREEN_W,
      y: Math.random() * SCREEN_H,
      size: Math.random() * 3 + 1,          // 1–4 px
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      delay: Math.random() * 2000,
      duration: 1500 + Math.random() * 2500, // 1.5–4s twinkle
      drift: (Math.random() - 0.5) * 30,    // ±15 px horizontal
      floatRange: Math.random() * 20 + 8,   // 8–28 px vertical float
    });
  }
  return particles;
}

// ─── Shooting-star config ────────────────────────────────────────────────────

interface ShootingStarConfig {
  id: number;
  startX: number;
  startY: number;
  angle: number;   // degrees
  length: number;
  delay: number;
  duration: number;
}

function buildShootingStars(count: number): ShootingStarConfig[] {
  const stars: ShootingStarConfig[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      id: i,
      startX: Math.random() * SCREEN_W * 0.8,
      startY: Math.random() * SCREEN_H * 0.5,
      angle: 25 + Math.random() * 20,        // 25–45°
      length: 60 + Math.random() * 80,
      delay: i * 1800 + Math.random() * 1000,
      duration: 600 + Math.random() * 400,
    });
  }
  return stars;
}

// ─── Single particle ─────────────────────────────────────────────────────────

function Particle({ cfg }: { cfg: ParticleConfig }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Twinkle: opacity pulse
    const twinkle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.15 + Math.random() * 0.75,
          duration: cfg.duration,
          delay: cfg.delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.05,
          duration: cfg.duration,
          useNativeDriver: true,
        }),
      ])
    );

    // Float: gentle up-down
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -cfg.floatRange,
          duration: cfg.duration * 1.4,
          delay: cfg.delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: cfg.duration * 1.4,
          useNativeDriver: true,
        }),
      ])
    );

    // Drift: subtle horizontal sway
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: cfg.drift,
          duration: cfg.duration * 1.8,
          delay: cfg.delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: cfg.duration * 1.8,
          useNativeDriver: true,
        }),
      ])
    );

    // Scale pulse for bigger stars
    const scalePulse = cfg.size >= 3
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.6,
              duration: cfg.duration * 1.2,
              delay: cfg.delay,
              useNativeDriver: true,
            }),
            Animated.timing(scale, { toValue: 1, duration: cfg.duration * 1.2, useNativeDriver: true }),
          ])
        )
      : null;

    twinkle.start();
    float.start();
    drift.start();
    scalePulse?.start();

    return () => {
      twinkle.stop();
      float.stop();
      drift.stop();
      scalePulse?.stop();
    };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cfg.x,
        top: cfg.y,
        width: cfg.size,
        height: cfg.size,
        borderRadius: cfg.size / 2,
        backgroundColor: cfg.color,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
        shadowColor: cfg.color,
        shadowOpacity: 0.9,
        shadowRadius: cfg.size * 2,
        elevation: 0,
      }}
    />
  );
}

// ─── Shooting star ────────────────────────────────────────────────────────────

function ShootingStar({ cfg }: { cfg: ShootingStarConfig }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: cfg.duration,
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(4000 + Math.random() * 3000),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const rad = (cfg.angle * Math.PI) / 180;
  const dx = Math.cos(rad) * cfg.length;
  const dy = Math.sin(rad) * cfg.length;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const opacity    = progress.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.6, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cfg.startX,
        top: cfg.startY,
        width: cfg.length,
        height: 2,
        borderRadius: 1,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate: `${cfg.angle}deg` }],
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.9)', 'rgba(192,132,252,0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const { hasSeenOnboarding } = usePlan();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;

  const particles     = useMemo(() => buildParticles(50), []);
  const shootingStars = useMemo(() => buildShootingStars(4), []);

  // Entrance + ring pulse
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Navigation logic
  useEffect(() => {
    const failsafe = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 6000);

    if (isLoading) return () => clearTimeout(failsafe);

    const timer = setTimeout(() => {
      clearTimeout(failsafe);
      if (user) {
        router.replace('/(tabs)');
      } else if (!hasSeenOnboarding) {
        router.replace('/onboarding');
      } else {
        router.replace('/(auth)/login');
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(failsafe);
    };
  }, [isLoading, user, hasSeenOnboarding]);

  const ringScale   = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.12, 0.35] });

  return (
    <LinearGradient
      colors={['#1A0533', '#0D1B4A', '#2D0A4E', '#0D1B4A', '#1A0533']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* ── Particles layer ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map(p => <Particle key={p.id} cfg={p} />)}
        {shootingStars.map(s => <ShootingStar key={s.id} cfg={s} />)}
      </View>

      {/* ── Static orbs ── */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      {/* ── Pulsing ring around logo ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      {/* ── Content ── */}
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
            <PulsingDot key={i} color={c} delay={i * 200} />
          ))}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.splash.powered}</Text>
      </View>
    </LinearGradient>
  );
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulsingDot({ color, delay }: { color: string; delay: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.spring(scale, { toValue: 1.6, friction: 3, tension: 80, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 80, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, transform: [{ scale }] }]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    opacity: 0.14,
    top: -80,
    left: -80,
  },
  orb2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.Accent,
    opacity: 0.11,
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
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: Colors.Primary,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.md,
    zIndex: 10,
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
    zIndex: 10,
  },
  footerText: {
    color: Colors.TextMuted,
    fontSize: FontSize.xs,
  },
});
