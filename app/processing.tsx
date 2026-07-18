import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideos } from '../hooks/useVideos';
import { useMusic } from '../hooks/useMusic';
import { MusicTrack } from '../constants/music';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import { useLanguage } from '../hooks/useLanguage';
import { getSupabaseClient } from '@/template';

const FINAL_VIDEO_WAIT_TIMEOUT_MS = 90000;
const FINAL_VIDEO_POLL_INTERVAL_MS = 2500;

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function isSimulatorMockVideoUri(value?: string | null) {
  return !!value && value.startsWith('simulator://');
}

function isRemoteUrl(value?: string | null) {
  if (!value) return false;
  return value.startsWith('https://') || value.startsWith('http://');
}

function looksLikeFinalVideoUrl(value?: string | null) {
  if (!value || !isRemoteUrl(value)) return false;

  const lower = value.toLowerCase();

  return (
    lower.includes('res.cloudinary.com') ||
    lower.includes('/video/upload/') ||
    lower.endsWith('.mp4') ||
    lower.includes('.mp4?')
  );
}

function pickFinalVideoUrl(video: any, originalLocalUri?: string | null) {
  const candidates = [
    video?.finalVideoUrl,
    video?.processedVideoUrl,
    video?.processedUrl,
    video?.cloudinaryUrl,
    video?.videoUrl,
    video?.videoUri,
    video?.url,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'string' &&
      looksLikeFinalVideoUrl(candidate) &&
      candidate !== originalLocalUri
    ) {
      return candidate;
    }
  }

  return null;
}

async function waitForFinalVideoReady(url: string, signal?: AbortSignal) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < FINAL_VIDEO_WAIT_TIMEOUT_MS) {
    if (signal?.aborted) {
      throw new Error('Operação cancelada.');
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal,
      });

      if (response.ok || response.status === 405) {
        return true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Operação cancelada.');
    }

    await delay(FINAL_VIDEO_POLL_INTERVAL_MS);
  }

  throw new Error('O vídeo final ainda não ficou disponível para preview.');
}

export default function ProcessingScreen() {
  const {
    duration,
    effect,
    eventId,
    eventName,
    eventColor,
    logoUrl,
    localVideoUri,
    kioskMode,
    musicSelection,
    frameCloudinaryId,
  } = useLocalSearchParams<{
    duration: string;
    effect: string;
    eventId: string;
    eventName: string;
    eventColor: string;
    logoUrl?: string;
    localVideoUri?: string;
    kioskMode?: string;
    musicSelection?: string;
    frameCloudinaryId?: string;
  }>();

  const { saveVideo } = useVideos();
  const { tracks: musicTracks, loading: musicLoading } = useMusic();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const musicTracksRef = useRef<MusicTrack[]>(musicTracks);
  const musicLoadingRef = useRef<boolean>(musicLoading);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    musicTracksRef.current = musicTracks;
    musicLoadingRef.current = musicLoading;
  }, [musicTracks, musicLoading]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const supabase = getSupabaseClient();

    cancelledRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const processVideo = async () => {
      try {
        if (isSimulatorMockVideoUri(localVideoUri)) {
          console.warn('[ProcessingScreen] simulator mock video detected', {
            localVideoUri,
          });

          throw new Error(
            'O simulador gerou um vídeo falso. Para testar o processamento final, grave em um dispositivo físico.'
          );
        }

        if (!localVideoUri) {
          throw new Error('Nenhum vídeo foi encontrado para processamento.');
        }

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
          controller.signal,
        );

        if (cancelledRef.current) return;

        const finalVideoUrl = pickFinalVideoUrl(video as any, localVideoUri || null);

        if (!finalVideoUrl) {
          throw new Error('Não foi possível encontrar a URL final do vídeo processado.');
        }

        await waitForFinalVideoReady(finalVideoUrl, controller.signal);

        if (cancelledRef.current) return;

        await supabase
          .from('recording_state')
          .upsert({
            event_id: String(eventId),
            status: 'ready',
            video_url: video.shareUrl || finalVideoUrl,
            thumbnail_url: null,
            qr_ready: true,
            updated_at: new Date().toISOString(),
          });

        if (cancelledRef.current) return;

        router.replace({
          pathname: '/preview',
          params: {
            shareUrl: video.shareUrl || finalVideoUrl,
            effect,
            eventName,
            eventColor,
            logoUrl: logoUrl || '',
            duration: video.duration?.toString?.() || duration || '15',
            thumbnailUri: '',
            localVideoUri: finalVideoUrl,
            kioskMode: kioskMode || '0',
          },
        });
      } catch (err: any) {
        console.error('Erro no processamento:', err);

        if (!cancelledRef.current) {
          Alert.alert(
            'Não foi possível processar o vídeo',
            err?.message || 'Tente gravar novamente.',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          );
        }
      }
    };

    processVideo();

    return () => {
      cancelledRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#0D0820', '#12073A', '#0A0F2E']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.spinnerGlow, { transform: [{ scale: pulseAnim }] }]} />

        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
          <MaterialIcons name="auto-awesome" size={40} color="#fff" />
        </Animated.View>

        <View style={styles.copyWrap}>
          <Text style={styles.title}>{t.processing.title}</Text>
          <Text style={styles.subtitle}>
            Estamos preparando o vídeo final com a moldura e a trilha sonora.
          </Text>
          <Text style={styles.helperText}>
            O preview será aberto assim que o arquivo final estiver pronto.
          </Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  spinnerGlow: {
    position: 'absolute',
    top: -14,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#8B5CF633',
  },
  spinner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 12,
  },
  copyWrap: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    color: '#fff',
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.TextSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  helperText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    color: Colors.TextSubtle,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});