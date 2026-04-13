import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useAlert } from '@/template';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { PRESET_CONFIGS } from '../services/videoEffectsService';
import { useLanguage } from '../hooks/useLanguage';

export default function PreviewScreen() {
  // ── ALL params must be destructured here, including thumbnailUri ──
  const {
    shareUrl, effect, eventName, eventColor, logoUrl,
    duration, thumbnailUri, localVideoUri, kioskMode,
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

  // Accept both local files and processed Cloudinary URLs
  const hasRealVideo = !!localVideoUri &&
    localVideoUri.length > 4 &&
    (localVideoUri.startsWith('file://') ||
      localVideoUri.startsWith('https://') ||
      localVideoUri.startsWith('http://'));

  // Detect Cloudinary URL BEFORE any useState that references it
  const isCloudinaryUrl = localVideoUri?.startsWith('https://res.cloudinary.com') ?? false;

  // Boomerang: loop=true, playbackRate=1x (effect already baked in Cloudinary)
  const player = useVideoPlayer(
    hasRealVideo ? localVideoUri! : null,
    p => {
      p.loop = true;
      p.muted = false;
      p.playbackRate = 1.0;
    }
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Show thumbnail cover until user taps play (only for Cloudinary videos with a thumbnail)
  const [showThumbnailCover, setShowThumbnailCover] = useState(
    isCloudinaryUrl && !!thumbnailUri
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Track playback state
  useEffect(() => {
    if (!player || !hasRealVideo) return;
    const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });
    return () => sub.remove();
  }, [player, hasRealVideo]);

  // Animate UI on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const ctaGlow = useRef(new Animated.Value(0.6)).current;
  const playBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaGlow, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(ctaGlow, { toValue: 0.5, duration: 1300, useNativeDriver: true }),
      ])
    ).start();

    if (!hasRealVideo) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(playBounce, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(playBounce, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }

    return () => {
      if (hasRealVideo && player) { try { player.pause(); } catch {} }
    };
  }, []);

  // Controls
  const handlePlayPause = useCallback(() => {
    if (!hasRealVideo || !player) return;
    // If thumbnail cover is showing, hide it and start playback
    if (showThumbnailCover) {
      setShowThumbnailCover(false);
      player.play();
      return;
    }
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player, hasRealVideo, showThumbnailCover]);

  const handleMuteToggle = useCallback(() => {
    if (!player) return;
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  }, [isMuted, player]);

  const handleSaveToGallery = useCallback(async () => {
    if (!localVideoUri || saving || saved) return;
    const videoToSave = localVideoUri;
    setSaving(true);
    try {
      // Request permission
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

      let localPath = videoToSave;

      // If it's a remote URL (Cloudinary), download to cache first
      if (videoToSave.startsWith('https://') || videoToSave.startsWith('http://')) {
        const fileUri = `${FileSystem.cacheDirectory}spinshot_${Date.now()}.mp4`;
        const downloadResult = await FileSystem.downloadAsync(videoToSave, fileUri);
        if (!downloadResult.uri) throw new Error('Download falhou');
        localPath = downloadResult.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localPath);
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
  }, [localVideoUri, saving, saved, t, showAlert]);

  const handleShare = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    if (hasRealVideo && player) { try { player.pause(); } catch {} }
    router.push({
      pathname: '/share',
      params: { shareUrl, eventName, eventColor, logoUrl: logoUrl || '', kioskMode: kioskMode || '0' },
    });
  }, [shareUrl, eventName, eventColor, kioskMode, hasRealVideo, player]);

  const onCtaIn = () =>
    Animated.spring(ctaScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onCtaOut = () =>
    Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true }).start();

  const THUMB_H = Math.min(dimensions.width * 0.85, 360);

  // Boomerang is the fixed effect

  return (
    <LinearGradient
      colors={['#0D0820', '#0A0F2E', '#0D0820']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Animated.View style={[styles.screen, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ─── Header ─── */}
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
            <Text style={styles.eventText} numberOfLines={1}>{eventName}</Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* ─── Status ─── */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: Colors.Success }]} />
          <Text style={styles.statusText}>{t.preview.title}</Text>
        </View>

        {/* ─── Video Player ─── */}
        <View style={[styles.videoCard, { height: THUMB_H }]}>
          {hasRealVideo ? (
            <>
              {/* Thumbnail cover — shown before first play on Cloudinary videos */}
              {showThumbnailCover && !!thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
                  transition={300}
                />
              ) : (
                <VideoView
                  player={player}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  nativeControls={false}
                />
              )}

              {/* Gradient overlay for readability */}
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.45)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />

              {/* Play/Pause — always visible over thumbnail cover or video */}
              <Pressable style={styles.playOverlay} onPress={handlePlayPause}>
                <Animated.View style={[
                  styles.playOuter,
                  !isPlaying && { transform: [{ scale: playBounce }] },
                ]}>
                  <LinearGradient
                    colors={[Colors.Primary + 'CC', Colors.Accent + 'CC']}
                    style={styles.playBtn}
                  >
                    <MaterialIcons
                      name={showThumbnailCover || !isPlaying ? 'play-arrow' : 'pause'}
                      size={50}
                      color="#fff"
                    />
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              {/* Mute toggle */}
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

              {/* Real video tag */}
              <View style={styles.liveTag}>
                <MaterialIcons name="fiber-manual-record" size={8} color={Colors.Success} />
                <Text style={styles.liveTagText}>VIDEO</Text>
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
              <View style={styles.playOverlay}>
                <Animated.View style={[styles.playOuter, { transform: [{ scale: playBounce }] }]}>
                  <LinearGradient
                    colors={[Colors.Primary, Colors.Accent]}
                    style={styles.playBtn}
                  >
                    <MaterialIcons name="play-arrow" size={50} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </View>
            </>
          )}

          {/* Preset badge */}
          <View style={styles.effectBadge}>
            <Text style={styles.effectEmoji}>{presetInfo?.emoji}</Text>
            <Text style={styles.effectLabel}>{presetInfo?.label}</Text>
          </View>

          {/* Duration badge */}
          <View style={styles.durationBadge}>
            <MaterialIcons name="timer" size={12} color="#fff" />
            <Text style={styles.durationText}>{duration}s</Text>
          </View>

          {/* Bottom color stripe */}
          <View style={[styles.thumbBottomBar, { backgroundColor: eventAccent }]} />
        </View>

        {hasRealVideo && (
          <View style={styles.effectInfoRow}>
            <MaterialIcons name="auto-awesome" size={14} color={eventAccent} />
            <Text style={[styles.effectInfoText, { color: eventAccent }]}>{t.preview.effectInfo}</Text>
          </View>
        )}

        {/* ─── Main CTA ─── */}
        <View style={styles.ctaWrap}>
          <Animated.View style={[styles.ctaGlow, { opacity: ctaGlow, shadowColor: Colors.Primary }]} />
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <Pressable onPressIn={onCtaIn} onPressOut={onCtaOut} onPress={handleShare}>
              <LinearGradient
                colors={['#C084FC', '#8B5CF6', '#4F46E5']}
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

        {/* ─── Save to Gallery ─── */}
        {hasRealVideo && (
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

        {/* ─── Secondary Actions ─── */}
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
  container: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: Spacing.lg, gap: Spacing.md, justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: {
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
  eventText: {
    color: Colors.TextSecondary, fontSize: FontSize.xs,
    fontWeight: FontWeight.medium, maxWidth: 160,
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: Colors.Success, fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  videoCard: {
    width: '100%', borderRadius: Radius.xl, overflow: 'hidden',
    position: 'relative', backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1, borderColor: Colors.Border,
  },
  thumbBg: { ...StyleSheet.absoluteFillObject },

  effectBadge: {
    position: 'absolute', top: 12, left: 12, zIndex: 4,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  effectEmoji: { fontSize: 13 },
  effectLabel: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  durationBadge: {
    position: 'absolute', top: 12, right: 12, zIndex: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  durationText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  liveTag: {
    position: 'absolute', bottom: 12, left: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveTagText: { color: Colors.Success, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1 },

  muteBtn: {
    position: 'absolute', bottom: 12, right: 12, zIndex: 5,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 3,
  },
  playOuter: {
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 24, elevation: 16,
  },
  playBtn: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  },

  thumbBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, zIndex: 4 },

  effectInfoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: -Spacing.xs,
  },
  effectInfoText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  ctaWrap: { position: 'relative' },
  ctaGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: Radius.full + 6,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1,
    shadowRadius: 20, elevation: 0, backgroundColor: 'transparent',
  },
  ctaBtn: {
    height: 66, borderRadius: Radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 16, elevation: 12,
  },
  ctaBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  secondaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border, overflow: 'hidden',
  },
  secBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 16,
  },
  secText: { color: Colors.TextSubtle, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  secDivider: { width: 1, height: 28, backgroundColor: Colors.Border },

  saveGalleryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: 13,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border,
  },
  saveGalleryBtnDone: {
    borderColor: Colors.Success + '55',
    backgroundColor: Colors.Success + '12',
  },
  saveGalleryText: {
    color: Colors.TextSubtle, fontSize: FontSize.sm, fontWeight: FontWeight.medium,
  },
});
