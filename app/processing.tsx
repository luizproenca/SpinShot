import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideos } from '../hooks/useVideos';
import { useMusic } from '../hooks/useMusic';
import { usePlan } from '../hooks/usePlan';
import { VideoSaveStep } from '../contexts/VideoContext';
import { MusicTrack } from '../constants/music';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import { useLanguage } from '../hooks/useLanguage';

const STEP_KEYS = ['uploading', 'processing', 'music', 'saving'] as const;
const STEP_ICONS = ['cloud-upload', 'auto-awesome', 'music-note', 'check-circle'] as const;
const STEP_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981'] as const;

const STEP_MS = 900;

export default function ProcessingScreen() {
  const { duration, effect, eventId, eventName, eventColor, logoUrl, localVideoUri, kioskMode, musicSelection, frameCloudinaryId } = useLocalSearchParams<{
    duration: string; effect: string; eventId: string; eventName: string; eventColor: string; logoUrl?: string; localVideoUri?: string; kioskMode?: string; musicSelection?: string; frameCloudinaryId?: string;
  }>();
  const { saveVideo } = useVideos();
  const { tracks: musicTracks, loading: musicLoading } = useMusic();
  const { isPro } = usePlan();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Keep a ref to musicTracks so the async saveVideo call always sees the latest value
  const musicTracksRef = useRef<MusicTrack[]>(musicTracks);
  const musicLoadingRef = useRef<boolean>(musicLoading);
  useEffect(() => {
    musicTracksRef.current = musicTracks;
    musicLoadingRef.current = musicLoading;
  }, [musicTracks, musicLoading]);

  const hasMusic = musicSelection && musicSelection !== 'none';

  const STEPS = [
    { icon: STEP_ICONS[0], label: t.processing.uploading, color: STEP_COLORS[0], key: STEP_KEYS[0] },
    { icon: STEP_ICONS[1], label: t.processing.applyingEffects, color: STEP_COLORS[1], key: STEP_KEYS[1] },
    ...(hasMusic ? [{ icon: STEP_ICONS[2], label: t.processing.addingMusic, color: STEP_COLORS[2], key: STEP_KEYS[2] }] : []),
    { icon: STEP_ICONS[3], label: t.processing.finishing, color: STEP_COLORS[3], key: STEP_KEYS[3] },
  ];

  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressGlow = useRef(new Animated.Value(0.5)).current;
  const stepAnims = useRef(STEP_KEYS.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(12),
  }))).current;

  // Animate a step into view
  const animateStep = (i: number) => {
    Animated.parallel([
      Animated.timing(stepAnims[i].opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(stepAnims[i].translateY, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: (i + 1) / STEPS.length,
      duration: STEP_MS - 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(progressGlow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(progressGlow, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Animate all steps appearing (cosmetic walkthrough)
    const runSteps = async () => {
      for (let i = 0; i < STEPS.length; i++) {
        await new Promise<void>(r => setTimeout(r, i === 0 ? 300 : STEP_MS));
        setCurrentStep(i);
        animateStep(i);
        if (i > 0) setCompletedSteps(prev => [...prev, i - 1]);
        await new Promise<void>(r => setTimeout(r, STEP_MS * 0.6));
      }
      setCompletedSteps([0, 1, 2, 3]);
    };

    runSteps();

    // Upload + Cloudinary processing
    const timeout = setTimeout(async () => {
      try {
        // Wait up to 5 seconds for music tracks to finish loading from Supabase
        if (musicLoadingRef.current && musicTracksRef.current.length === 0) {
          await new Promise<void>(resolve => {
            const start = Date.now();
            const poll = setInterval(() => {
              if (!musicLoadingRef.current || musicTracksRef.current.length > 0 || Date.now() - start > 5000) {
                clearInterval(poll);
                resolve();
              }
            }, 150);
          });
        }

        const resolvedTracks = musicTracksRef.current;
        console.log('[processing] musicTracks resolved:', resolvedTracks.length, 'tracks');

        const video = await saveVideo(
          {
            eventId,
            eventName,
            eventColor,
            effect,
            duration: parseInt(duration || '15', 10),
            videoUri: localVideoUri || undefined,
            musicSelection: (musicSelection as any) || 'auto',
            musicTracks: resolvedTracks,
            frameCloudinaryId: frameCloudinaryId || null,
          },
          (step: VideoSaveStep) => {
            const idx = step === 'uploading' ? 0 : step === 'processing' ? 1 : 3;
            setCurrentStep(prev => Math.max(prev, idx));
            animateStep(idx);
          },
        );

        // Prefer Cloudinary processed URL, fall back to original local URI so preview always has something to show
        const videoUriForPreview = video.videoUri || localVideoUri || '';

        router.replace({
          pathname: '/preview',
          params: {
            shareUrl: video.shareUrl,
            effect,
            eventName,
            eventColor,
            logoUrl: logoUrl || '',
            duration: video.duration.toString(),
            thumbnailUri: video.thumbnailUri || '',
            localVideoUri: videoUriForPreview,
            kioskMode: kioskMode || '0',
          },
        });
      } catch (err) {
        console.error('Processing failed, going to preview with local video:', err);
        if (localVideoUri) {
          router.replace({
            pathname: '/preview',
            params: {
              shareUrl: '',
              effect,
              eventName,
              eventColor,
              logoUrl: logoUrl || '',
              duration,
              thumbnailUri: '',
              localVideoUri,
              kioskMode: kioskMode || '0',
            },
          });
        } else {
          router.back();
        }
      }
    }, STEPS.length * STEP_MS + 600);

    return () => clearTimeout(timeout);
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinReverse = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <LinearGradient colors={['#0D0820', '#12073A', '#0A0F2E']} style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        <View style={styles.spinnerOuter}>
          <Animated.View style={[styles.spinRing1, { transform: [{ rotate: spin }] }]} />
          <Animated.View style={[styles.spinRing2, { transform: [{ rotate: spinReverse }] }]} />
          <LinearGradient colors={['#1E1250', '#2A1870']} style={styles.spinCore}>
            <Text style={styles.spinEmoji}>✨</Text>
          </LinearGradient>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t.processing.title}</Text>
          <Text style={styles.subtitle}>{t.processing.subtitle}</Text>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
              <Animated.View style={[styles.progressGlowDot, { opacity: progressGlow }]} />
            </Animated.View>
          </View>
        </View>

        <View style={styles.stepsCard}>
          {STEPS.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = currentStep === i && !isDone;

            return (
              <Animated.View
                key={step.key}
                style={[
                  styles.stepRow,
                  isActive && { backgroundColor: step.color + '12' },
                  isDone && styles.stepDoneRow,
                  {
                    opacity: stepAnims[i].opacity,
                    transform: [{ translateY: stepAnims[i].translateY }],
                  },
                ]}
              >
                <View style={[
                  styles.stepIcon,
                  isDone && { backgroundColor: step.color, borderColor: step.color },
                  isActive && { borderColor: step.color, backgroundColor: step.color + '20' },
                ]}>
                  <MaterialIcons
                    name={isDone ? 'check' : step.icon}
                    size={15}
                    color={isDone ? '#fff' : isActive ? step.color : Colors.TextMuted}
                  />
                </View>

                <Text style={[
                  styles.stepLabel,
                  isActive && { color: Colors.TextPrimary, fontWeight: FontWeight.semibold },
                  isDone && { color: Colors.TextSubtle },
                ]}>
                  {isActive ? '→  ' : ''}{step.label}{isActive ? '...' : ''}
                </Text>

                {isDone && <MaterialIcons name="check" size={14} color={step.color} />}
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: Spacing.xl, paddingHorizontal: Spacing.lg, width: '100%', maxWidth: 420 },

  spinnerOuter: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  spinRing1: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: 'transparent',
    borderTopColor: Colors.Primary, borderRightColor: Colors.Accent,
  },
  spinRing2: {
    position: 'absolute', width: 94, height: 94, borderRadius: 47,
    borderWidth: 2, borderColor: 'transparent',
    borderTopColor: Colors.Secondary + '99', borderLeftColor: Colors.Primary + '55',
  },
  spinCore: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border,
  },
  spinEmoji: { fontSize: 32 },

  titleBlock: { alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.TextSubtle },

  progressWrap: { width: '100%' },
  progressTrack: {
    height: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 5,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.Border,
  },
  progressFill: {
    height: '100%', borderRadius: 5, backgroundColor: Colors.Primary,
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 8, elevation: 6,
  },
  progressGlowDot: {
    position: 'absolute', right: -4, top: -4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 8,
  },

  stepsCard: {
    width: '100%', backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.Border,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.Border,
  },
  stepDoneRow: { opacity: 0.65 },
  stepIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.Surface, borderWidth: 1.5, borderColor: Colors.Border,
  },
  stepLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.TextMuted },
});
