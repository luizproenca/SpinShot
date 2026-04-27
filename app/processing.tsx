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
import { getSupabaseClient } from '@/template'; // 👈 NOVO

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
    const supabase = getSupabaseClient(); // 👈 NOVO

    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    ).start();

    const runSteps = async () => {
      for (let i = 0; i < STEPS.length; i++) {
        await new Promise<void>(r => setTimeout(r, i === 0 ? 300 : STEP_MS));
        setCurrentStep(i);
        animateStep(i);
        if (i > 0) setCompletedSteps(prev => [...prev, i - 1]);
        await new Promise<void>(r => setTimeout(r, STEP_MS * 0.6));
      }
    };

    runSteps();

    const timeout = setTimeout(async () => {
      try {
        const video = await saveVideo(
          {
            eventId,
            eventName,
            eventColor,
            effect,
            duration: parseInt(duration || '15', 10),
            videoUri: localVideoUri || undefined,
            musicSelection: (musicSelection as any) || 'auto',
            musicTracks: musicTracksRef.current,
            frameCloudinaryId: frameCloudinaryId || null,
          },
          () => {},
        );

        // 🔥 AQUI ESTÁ A MÁGICA DO QR CODE
        await supabase
          .from('recording_state')
          .upsert({
            event_id: String(eventId),
            status: 'ready',
            video_url: video.shareUrl,
            thumbnail_url: video.thumbnailUri || null,
            qr_ready: true,
            updated_at: new Date().toISOString(),
          });

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
            localVideoUri: video.videoUri || '',
            kioskMode: kioskMode || '0',
          },
        });

      } catch (err) {
        console.error('Erro no processamento:', err);
        router.back();
      }
    }, STEPS.length * STEP_MS + 600);

    return () => clearTimeout(timeout);
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient colors={['#0D0820', '#12073A', '#0A0F2E']} style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
          <MaterialIcons name="auto-awesome" size={40} color="#fff" />
        </Animated.View>

        <Text style={styles.title}>{t.processing.title}</Text>
        <Text style={styles.subtitle}>{t.processing.subtitle}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', gap: 20 },
  spinner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
  },
  title: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#ccc' },
});