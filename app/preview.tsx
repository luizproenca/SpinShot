import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAlert } from '@/template';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { PRESET_CONFIGS } from '../services/videoEffectsService';
import { useLanguage } from '../hooks/useLanguage';

function isFinalRemoteVideoUrl(value?: string | null) {
  if (!value) return false;

  const lower = value.toLowerCase();
  const isRemote = lower.startsWith('https://') || lower.startsWith('http://');

  if (!isRemote) return false;

  return (
    lower.includes('res.cloudinary.com') ||
    lower.includes('/video/upload/') ||
    lower.endsWith('.mp4') ||
    lower.includes('.mp4?')
  );
}

export default function PreviewScreen() {
  const {
    shareUrl,
    effect,
    eventName,
    eventColor,
    logoUrl,
    duration,
    localVideoUri,
    kioskMode,
  } = useLocalSearchParams<{
    shareUrl: string;
    effect: string;
    eventName: string;
    eventColor: string;
    logoUrl?: string;
    duration: string;
    thumbnailUri?: string;
    localVideoUri?: string;
    kioskMode?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { showAlert } = useAlert();

  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDimensions(window));
    return () => sub?.remove();
  }, []);

  const presetInfo = PRESET_CONFIGS[effect as keyof typeof PRESET_CONFIGS] ?? PRESET_CONFIGS.boomerang;
  const eventAccent = eventColor || Colors.Primary;

  const finalVideoUrl = isFinalRemoteVideoUrl(localVideoUri) ? localVideoUri! : null;
  const hasFinalVideo = !!finalVideoUrl;

  const player = useVideoPlayer(
    hasFinalVideo ? finalVideoUrl : null,
    p => {
      p.loop = true;
      p.muted = false;
      p.playbackRate = 1.0;

      try {
        p.pause();
      } catch {}
    }
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!player || !hasFinalVideo) return;

    try {
      player.pause();
    } catch {}

    const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });

    return () => sub.remove();
  }, [player, hasFinalVideo]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const ctaGlow = useRef(new Animated.Value(0.6)).current;
  const playBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaGlow, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(ctaGlow, {
          toValue: 0.5,
          duration: 1300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(playBounce, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(playBounce, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      if (hasFinalVideo && player) {
        try {
          player.pause();
        } catch {}
      }
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!hasFinalVideo || !player) {
      showAlert(
        'Vídeo ainda não está pronto',
        'Aguarde o processamento do vídeo final antes de reproduzir.',
        [{ text: t.common.ok }]
      );
      return;
    }

    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player, hasFinalVideo, showAlert, t]);

  const handleMuteToggle = useCallback(() => {
    if (!player || !hasFinalVideo) return;

    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  }, [isMuted, player, hasFinalVideo]);

  const handleSaveToGallery = useCallback(async () => {
    if (!finalVideoUrl || saving || saved) return;

    setSaving(true);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        showAlert(
          t.preview.saveError,
          t.preview.permissionMsg,
          [{ text: t.common.ok }]
        );
        setSaving(false);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}spinshot_${Date.now()}.mp4`;
      const downloadResult = await FileSystem.downloadAsync(finalVideoUrl, fileUri);

      if (!downloadResult.uri) {
        throw new Error('Download falhou');
      }

      await MediaLibrary.saveToLibraryAsync(downloadResult.uri);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.warn('Save to gallery failed:', err.message);

      showAlert(
        t.preview.saveError,
        err.message || 'Tente novamente.',
        [{ text: t.common.ok }]
      );
    } finally {
      setSaving(false);
    }
  }, [finalVideoUrl, saving, saved, t, showAlert]);

  const handleShare = useCallback(async () => {
    if (!hasFinalVideo) {
      showAlert(
        'Vídeo ainda não está pronto',
        'Aguarde o processamento do vídeo final antes de compartilhar.',
        [{ text: t.common.ok }]
      );
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    if (player) {
      try {
        player.pause();
      } catch {}
    }

    router.push({
      pathname: '/share',
      params: {
        shareUrl: shareUrl || finalVideoUrl || '',
        eventName,
        eventColor,
        logoUrl: logoUrl || '',
        kioskMode: kioskMode || '0',
      },
    });
  }, [
    shareUrl,
    finalVideoUrl,
    eventName,
    eventColor,
    logoUrl,
    kioskMode,
    hasFinalVideo,
    player,
    router,
    showAlert,
    t,
  ]);

  const onCtaIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const onCtaOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const THUMB_H = Math.min(dimensions.width * 0.85, 360);

  return (
    <LinearGradient
      colors={['#0D0820', '#0A0F2E', '#0D0820']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Animated.View
        style={[
          styles.screen,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => router.replace('/(tabs)/videos')}
            hitSlop={8}
          >
            <MaterialIcons name="close" size={18} color={Colors.TextSubtle} />
          </Pressable>

          <View style={[styles.eventChip, { borderColor: eventAccent + '55' }]}>
            <View style={[styles.eventDot, { backgroundColor: eventAccent }]} />
            <Text style={styles.eventText} numberOfLines={1}>
              {eventName}
            </Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: hasFinalVideo ? Colors.Success : Colors.Warning }]} />
          <Text style={[styles.statusText, { color: hasFinalVideo ? Colors.Success : Colors.Warning }]}>
            {hasFinalVideo ? t.preview.title : 'Preparando vídeo final'}
          </Text>
        </View>

        <View style={[styles.videoCard, { height: THUMB_H }]}>
          {hasFinalVideo ? (
            <>
              <VideoView
                player={player}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                nativeControls={false}
              />

              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.45)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />

              <Pressable style={styles.playOverlay} onPress={handlePlayPause}>
                <Animated.View
                  style={[
                    styles.playOuter,
                    !isPlaying && { transform: [{ scale: playBounce }] },
                  ]}
                >
                  <LinearGradient
                    colors={[Colors.Primary + 'CC', Colors.Accent + 'CC']}
                    style={styles.playBtn}
                  >
                    <MaterialIcons
                      name={isPlaying ? 'pause' : 'play-arrow'}
                      size={50}
                      color="#fff"
                    />
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              <Pressable
                style={styles.muteBtn}
                onPress={handleMuteToggle}
                hitSlop={8}
              >
                <MaterialIcons
                  name={isMuted ? 'volume-off' : 'volume-up'}
                  size={18}
                  color="rgba(255,255,255,0.9)"
                />
              </Pressable>

              <View style={styles.liveTag}>
                <MaterialIcons name="fiber-manual-record" size={8} color={Colors.Success} />
                <Text style={styles.liveTagText}>FINAL</Text>
              </View>
            </>
          ) : (
            <>
              <LinearGradient
                colors={[eventAccent + '44', '#1A1740', '#0D0820']}
                style={styles.thumbBg}
              />

              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={StyleSheet.absoluteFillObject}
              />

              <View style={styles.notReadyContent}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.notReadyTitle}>Vídeo final em preparação</Text>
                <Text style={styles.notReadySubtitle}>
                  O preview será exibido somente com o vídeo final processado.
                </Text>
              </View>
            </>
          )}

          <View style={styles.effectBadge}>
            <Text style={styles.effectEmoji}>{presetInfo?.emoji}</Text>
            <Text style={styles.effectLabel}>{presetInfo?.label}</Text>
          </View>

          <View style={styles.durationBadge}>
            <MaterialIcons name="timer" size={12} color="#fff" />
            <Text style={styles.durationText}>{duration}s</Text>
          </View>

          <View style={[styles.thumbBottomBar, { backgroundColor: eventAccent }]} />
        </View>

        {hasFinalVideo && (
          <View style={styles.effectInfoRow}>
            <MaterialIcons name="auto-awesome" size={14} color={eventAccent} />
            <Text style={[styles.effectInfoText, { color: eventAccent }]}>
              {t.preview.effectInfo}
            </Text>
          </View>
        )}

        <View style={styles.ctaWrap}>
          <Animated.View
            style={[
              styles.ctaGlow,
              {
                opacity: hasFinalVideo ? ctaGlow : 0.2,
                shadowColor: Colors.Primary,
              },
            ]}
          />

          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <Pressable
              onPressIn={onCtaIn}
              onPressOut={onCtaOut}
              onPress={handleShare}
              disabled={!hasFinalVideo}
            >
              <LinearGradient
                colors={hasFinalVideo ? ['#C084FC', '#8B5CF6', '#4F46E5'] : ['#4B5563', '#374151']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                <MaterialIcons name="qr-code" size={26} color="#fff" />
                <Text style={styles.ctaBtnText}>{t.preview.share}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>

        {hasFinalVideo && (
          <Pressable
            style={({ pressed }) => [
              styles.saveGalleryBtn,
              saved && styles.saveGalleryBtnDone,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleSaveToGallery}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.TextSubtle} />
            ) : (
              <MaterialIcons
                name={saved ? 'check-circle' : 'save-alt'}
                size={17}
                color={saved ? Colors.Success : Colors.TextSubtle}
              />
            )}

            <Text style={[styles.saveGalleryText, saved && { color: Colors.Success }]}>
              {saving ? t.preview.saving : saved ? t.preview.savedSuccess : t.preview.saveToPhone}
            </Text>
          </Pressable>
        )}

        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [styles.secBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.back()}
          >
            <MaterialIcons name="refresh" size={17} color={Colors.TextSubtle} />
            <Text style={styles.secText}>{t.preview.redo}</Text>
          </Pressable>

          <View style={styles.secDivider} />

          <Pressable
            style={({ pressed }) => [styles.secBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.replace('/(tabs)/videos')}
          >
            <MaterialIcons name="video-library" size={17} color={Colors.TextSubtle} />
            <Text style={styles.secText}>{t.tabs.videos}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.SurfaceElevated,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  eventText: {
    color: Colors.TextSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    maxWidth: 160,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  videoCard: {
    width: '100%',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  thumbBg: {
    ...StyleSheet.absoluteFillObject,
  },
  notReadyContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  notReadyTitle: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  notReadySubtitle: {
    color: Colors.TextSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  effectBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  effectEmoji: {
    fontSize: 13,
  },
  effectLabel: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  durationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durationText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  liveTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveTagText: {
    color: Colors.Success,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  muteBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  playOuter: {
    shadowColor: Colors.Primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 16,
  },
  playBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  thumbBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 4,
  },
  effectInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -Spacing.xs,
  },
  effectInfoText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  ctaWrap: {
    position: 'relative',
  },
  ctaGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: Radius.full + 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 0,
    backgroundColor: 'transparent',
  },
  ctaBtn: {
    height: 66,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    shadowColor: Colors.Primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
  },
  secBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
  },
  secText: {
    color: Colors.TextSubtle,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  secDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.Border,
  },
  saveGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 13,
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  saveGalleryBtnDone: {
    borderColor: Colors.Success + '55',
    backgroundColor: Colors.Success + '12',
  },
  saveGalleryText: {
    color: Colors.TextSubtle,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});