import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  Platform, Modal, Switch, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useEvents } from '../../hooks/useEvents';
import { useLanguage } from '../../hooks/useLanguage';
import { usePlan } from '../../hooks/usePlan';
import { useMusic } from '../../hooks/useMusic';
import { formatExpiryDate, getTrialRemainingDays } from '../../services/subscriptionService';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { RECORDING_DURATIONS } from '../../constants/config';
import { DEFAULT_PRESET, VideoPreset } from '../../services/videoEffectsService';
import {
  MusicTrack, MusicSelection,
  MUSIC_AUTO_ID, MUSIC_NONE_ID, CATEGORY_META,
} from '../../constants/music';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_H * 0.78, 640);

const UI_EFFECTS: Array<{
  id: VideoPreset;
  label: string;
  emoji: string;
  description: string;
  accent: string;
}> = [
  {
    id: 'boomerang',
    label: 'Boomerang',
    emoji: '🔁',
    description: 'Ida e volta — efeito clássico',
    accent: Colors.Primary,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    emoji: '🎬',
    description: 'Slow + reverse suave',
    accent: '#F59E0B',
  },
  {
    id: 'hype',
    label: 'Hype',
    emoji: '⚡',
    description: 'Rápido e impactante',
    accent: '#EC4899',
  },
];

function EffectOptionCard({
  effect,
  isActive,
  onPress,
  isLocked,
}: {
  effect: (typeof UI_EFFECTS)[number];
  isActive: boolean;
  onPress: () => void;
  isLocked?: boolean;
}) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const glowAnim = useRef(new Animated.Value(0.75)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.65,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim, iconScale, shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-70, 120],
  });

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.effectCard,
        isActive && {
          borderColor: effect.accent,
          backgroundColor: effect.accent + '0A',
        },
      ]}
    >
      {isActive && (
        <LinearGradient
          colors={[effect.accent + '22', effect.accent + '08']}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <View style={styles.effectPreviewStage}>
        <LinearGradient
          colors={['#201A45', '#120F2A', '#0D0820']}
          style={StyleSheet.absoluteFillObject}
        />

        <Animated.View
          style={[
            styles.effectPreviewGlow,
            {
              opacity: glowAnim,
              backgroundColor: effect.accent + '44',
              transform: [{ scale: glowAnim }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.effectPreviewShimmer,
            {
              transform: [{ translateX: shimmerTranslate }, { rotate: '14deg' }],
            },
          ]}
        />

        <View style={styles.effectPreviewFrame}>
          <View
            style={[
              styles.effectPreviewFrameLine,
              { borderColor: effect.accent + (isActive ? 'CC' : '77') },
            ]}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: iconScale }], zIndex: 3 }}>
          <Text style={styles.effectPreviewEmoji}>{effect.emoji}</Text>
        </Animated.View>

        {isLocked && (
          <View style={styles.effectLockOverlay}>
            <MaterialIcons name="lock" size={18} color="rgba(255,255,255,0.85)" />
          </View>
        )}
      </View>

      <Text style={[styles.effectLabel, isActive && { color: effect.accent }, isLocked && { color: Colors.TextMuted }]}>
        {effect.label}{isLocked ? ' 🔒' : ''}
      </Text>
    </Pressable>
  );
}

function MusicCard({
  track, isSelected, isPro, onPress, onUpgrade, lockedLabel,
  playingId, onPlayPreview,
}: {
  track: MusicTrack; isSelected: boolean; isPro: boolean;
  onPress: () => void; onUpgrade: () => void; lockedLabel: string;
  playingId: string | null;
  onPlayPreview: (id: string, url: string) => void;
}) {
  const isLocked = track.isPremium && !isPro;
  const isPlaying = playingId === track.id;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const catMeta = CATEGORY_META[track.category];

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const handlePreviewPress = (e: any) => {
    e.stopPropagation?.();
    if (isLocked) { onUpgrade(); return; }
    if (!track.previewUrl) return;
    onPlayPreview(track.id, track.previewUrl);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={isLocked ? onUpgrade : onPress}
        style={[
          styles.musicCard,
          isSelected && { borderColor: catMeta.color + '88', backgroundColor: catMeta.color + '0D' },
          isLocked && styles.musicCardLocked,
        ]}
      >
        {isSelected && (
          <LinearGradient
            colors={[catMeta.color + '18', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <View style={[styles.musicEmojiWrap, { backgroundColor: catMeta.color + '22' }]}>
          <Text style={styles.musicEmoji}>{track.emoji}</Text>
        </View>
        <View style={styles.musicInfo}>
          <Text style={[styles.musicTitle, isLocked && styles.musicTitleLocked]} numberOfLines={1}>
            {track.title}
          </Text>
          <View style={styles.musicMeta}>
            <Text style={[styles.musicCategory, { color: catMeta.color }]}>{track.emoji}</Text>
            <Text style={styles.musicBpm}>{track.bpm} BPM</Text>
          </View>
        </View>

        {!isLocked && track.previewUrl ? (
          <Pressable
            onPress={handlePreviewPress}
            hitSlop={8}
            style={[styles.previewBtn, isPlaying && { backgroundColor: catMeta.color + '22' }]}
          >
            <MaterialIcons
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={18}
              color={isPlaying ? catMeta.color : Colors.TextSubtle}
            />
          </Pressable>
        ) : null}

        {isLocked ? (
          <View style={styles.lockWrap}>
            <MaterialIcons name="lock" size={14} color={Colors.TextMuted} />
          </View>
        ) : isSelected ? (
          <View style={[styles.checkWrap, { backgroundColor: catMeta.color }]}>
            <MaterialIcons name="check" size={14} color="#fff" />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const PREVIEW_DURATION_MS = 15_000;

function ConfigSheet({
  visible, onClose, duration, setDuration,
  selectedEffect, setSelectedEffect,
  musicSelection, setMusicSelection, isPro, labels, onUpgrade,
  freeTracks, premiumTracks, musicLoading, autoTrack,
}: {
  visible: boolean; onClose: () => void;
  duration: number; setDuration: (d: number) => void;
  selectedEffect: VideoPreset; setSelectedEffect: (e: VideoPreset) => void;
  musicSelection: MusicSelection; setMusicSelection: (m: MusicSelection) => void;
  isPro: boolean;
  labels: {
    sheetTitle: string; durationLabel: string;
    musicLabel: string;
    autoMusicLabel: string; autoMusicSub: string;
    noMusicLabel: string; noMusicSub: string;
    lockedLabel: string; unlockBanner: string; upgradeLabel: string;
    libraryLabel: string; loadingTracksLabel: string;
  };
  onUpgrade: () => void;
  freeTracks: MusicTrack[];
  premiumTracks: MusicTrack[];
  musicLoading: boolean;
  autoTrack: MusicTrack | null;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'effects' | 'music'>('effects');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeEffect = UI_EFFECTS.find(e => e.id === selectedEffect) ?? UI_EFFECTS[0];

  const stopPreview = useCallback(async () => {
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    setPlayingId(null);
    setLoadingPreviewId(null);
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      stopPreview();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, stopPreview, backdropOpacity, slideAnim]);

  useEffect(() => () => { stopPreview(); }, [stopPreview]);

  const allTracks = [...freeTracks, ...premiumTracks];

  const handlePlayPreview = useCallback(async (trackId: string, url: string) => {
    if (playingId === trackId) { await stopPreview(); return; }
    await stopPreview();
    try {
      setLoadingPreviewId(trackId);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 },
      );
      soundRef.current = sound;
      setPlayingId(trackId);
      setLoadingPreviewId(null);
      previewTimerRef.current = setTimeout(async () => {
        await stopPreview();
      }, PREVIEW_DURATION_MS);
    } catch {
      setLoadingPreviewId(null);
      setPlayingId(null);
    }
  }, [playingId, stopPreview]);

  const handleClose = useCallback(() => {
    stopPreview();
    if (Platform.OS !== 'web') { try { Haptics.selectionAsync(); } catch {} }
    onClose();
  }, [onClose, stopPreview]);

  const handleDurationPress = useCallback((val: number) => {
    setDuration(val);
    if (Platform.OS !== 'web') { try { Haptics.selectionAsync(); } catch {} }
  }, [setDuration]);

  const handleMusicPress = useCallback((id: MusicSelection) => {
    setMusicSelection(id);
    if (Platform.OS !== 'web') { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }
  }, [setMusicSelection]);

  const handleEffectPress = useCallback((effectId: VideoPreset) => {
    setSelectedEffect(effectId);
    if (Platform.OS !== 'web') { try { Haptics.selectionAsync(); } catch {} }
  }, [setSelectedEffect]);

  if (!mounted && !visible) return null;

  const {
    sheetTitle, durationLabel, musicLabel,
    autoMusicLabel, autoMusicSub, noMusicLabel, noMusicSub,
    lockedLabel, unlockBanner, upgradeLabel,
  } = labels;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: SHEET_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom + Spacing.md,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.sheetFixed}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            <Pressable onPress={handleClose} style={styles.sheetCloseBtn} hitSlop={12}>
              <MaterialIcons name="close" size={18} color={Colors.TextSubtle} />
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            {(['effects', 'music'] as const).map(tab => (
              <Pressable
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <MaterialIcons
                  name={tab === 'effects' ? 'auto-awesome' : 'music-note'}
                  size={14}
                  color={activeTab === tab ? '#fff' : Colors.TextMuted}
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'effects' ? 'Efeitos' : musicLabel}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sheetSection}>
            <View style={styles.sheetSectionHeader}>
              <Text style={styles.sheetSectionLabel}>{durationLabel}</Text>
            </View>
            <View style={styles.segmentedGroup}>
              {RECORDING_DURATIONS.map((d, i) => {
                const isSelected = duration === d.value;
                const isLocked = !isPro && d.value > 10;
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => handleDurationPress(d.value)}
                    style={[
                      styles.segment,
                      i === 0 && styles.segmentFirst,
                      i === RECORDING_DURATIONS.length - 1 && styles.segmentLast,
                      isSelected && styles.segmentActive,
                    ]}
                    hitSlop={4}
                  >
                    {isSelected && (
                      <LinearGradient
                        colors={['#C084FC', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    {isLocked && !isSelected && (
                      <View style={styles.segmentLockIcon}>
                        <MaterialIcons name="lock" size={9} color={Colors.TextMuted} />
                      </View>
                    )}
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextActive, isLocked && !isSelected && { color: Colors.TextMuted }]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {activeTab === 'effects' && (
          <View style={[styles.sheetSection, styles.effectsSection]}>
            <View style={styles.effectsRow}>
              {UI_EFFECTS.map(item => (
                <EffectOptionCard
                  key={item.id}
                  effect={item}
                  isActive={selectedEffect === item.id}
                  isLocked={!isPro && (item.id === 'cinematic' || item.id === 'hype')}
                  onPress={() => handleEffectPress(item.id)}
                />
              ))}
            </View>

            <View
              style={[
                styles.effectDesc,
                {
                  borderColor: activeEffect.accent + '2A',
                  backgroundColor: activeEffect.accent + '0E',
                },
              ]}
            >
              <View style={[styles.effectDescDot, { backgroundColor: activeEffect.accent }]} />
              <Text style={styles.effectDescText} numberOfLines={2}>
                <Text style={[styles.effectDescName, { color: activeEffect.accent }]}>
                  {activeEffect.label}{' '}
                </Text>
                <Text style={styles.effectDescSub}>— {activeEffect.description}</Text>
              </Text>
            </View>

            <View style={styles.effectHintBox}>
              <MaterialIcons name="check-circle-outline" size={14} color={Colors.Success} />
              <Text style={styles.effectHintText}>
                O efeito escolhido será usado na gravação e no processamento final do vídeo.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'music' && (
          <ScrollView
            style={styles.musicScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.xs, paddingBottom: Spacing.lg }}
          >
            <Pressable
              style={[
                styles.musicSpecialCard,
                musicSelection === MUSIC_AUTO_ID && styles.musicSpecialCardActive,
              ]}
              onPress={() => handleMusicPress(MUSIC_AUTO_ID)}
            >
              {musicSelection === MUSIC_AUTO_ID && (
                <LinearGradient
                  colors={['#7C3AED22', '#4F46E522']}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              <View style={[styles.musicSpecialIcon, { backgroundColor: Colors.Primary + '22' }]}>
                <MaterialIcons name="auto-awesome" size={18} color={Colors.Primary} />
              </View>
              <View style={styles.musicSpecialInfo}>
                <Text style={[styles.musicSpecialTitle, musicSelection === MUSIC_AUTO_ID && { color: Colors.Primary }]}>
                  {autoMusicLabel}
                </Text>
                <Text style={styles.musicSpecialSub}>
                  {autoMusicSub}
                  {autoTrack ? ` · ${autoTrack.emoji} ${autoTrack.title}` : ''}
                </Text>
              </View>
              {musicSelection === MUSIC_AUTO_ID && (
                <MaterialIcons name="check-circle" size={18} color={Colors.Primary} />
              )}
            </Pressable>

            <Pressable
              style={[
                styles.musicSpecialCard,
                musicSelection === MUSIC_NONE_ID && styles.musicSpecialCardNone,
              ]}
              onPress={() => handleMusicPress(MUSIC_NONE_ID)}
            >
              <View style={[styles.musicSpecialIcon, { backgroundColor: Colors.TextMuted + '22' }]}>
                <MaterialIcons name="music-off" size={18} color={Colors.TextMuted} />
              </View>
              <View style={styles.musicSpecialInfo}>
                <Text style={styles.musicSpecialTitle}>{noMusicLabel}</Text>
                <Text style={styles.musicSpecialSub}>{noMusicSub}</Text>
              </View>
              {musicSelection === MUSIC_NONE_ID && (
                <MaterialIcons name="check-circle" size={18} color={Colors.TextSubtle} />
              )}
            </Pressable>

            <View style={styles.musicDivider}>
              <View style={styles.musicDividerLine} />
              <Text style={styles.musicDividerText}>{labels.libraryLabel}</Text>
              <View style={styles.musicDividerLine} />
            </View>

            {musicLoading && (
              <View style={styles.musicLoadingRow}>
                <ActivityIndicator size="small" color={Colors.Primary} />
                <Text style={styles.musicLoadingText}>{labels.loadingTracksLabel}</Text>
              </View>
            )}

            {!musicLoading && freeTracks.map(track => (
              <MusicCard
                key={track.id}
                track={track}
                isSelected={musicSelection === track.id}
                isPro={isPro}
                onPress={() => handleMusicPress(track.id)}
                onUpgrade={onUpgrade}
                lockedLabel={lockedLabel}
                playingId={loadingPreviewId ?? playingId}
                onPlayPreview={handlePlayPreview}
              />
            ))}

            {!musicLoading && premiumTracks.map(track => (
              <MusicCard
                key={track.id}
                track={track}
                isSelected={musicSelection === track.id}
                isPro={isPro}
                onPress={() => handleMusicPress(track.id)}
                onUpgrade={onUpgrade}
                lockedLabel={lockedLabel}
                playingId={loadingPreviewId ?? playingId}
                onPlayPreview={handlePlayPreview}
              />
            ))}

            {(playingId || loadingPreviewId) && (
              <View style={styles.previewIndicator}>
                {loadingPreviewId ? (
                  <ActivityIndicator size={12} color={Colors.Primary} />
                ) : (
                  <Animated.View style={styles.previewDot} />
                )}
                <Text style={styles.previewIndicatorText}>
                  {loadingPreviewId
                    ? 'Carregando preview...'
                    : `Preview · ${allTracks.find(t => t.id === playingId)?.title ?? ''} · 15s`}
                </Text>
                <Pressable onPress={stopPreview} hitSlop={8}>
                  <MaterialIcons name="close" size={14} color={Colors.TextMuted} />
                </Pressable>
              </View>
            )}

            {!isPro && !musicLoading && (
              <Pressable style={styles.musicUpsellBanner} onPress={onUpgrade}>
                <LinearGradient
                  colors={['#7C3AED33', '#EC489933']}
                  style={styles.musicUpsellBannerBg}
                >
                  <MaterialIcons name="lock-open" size={16} color={Colors.Primary} />
                  <Text style={styles.musicUpsellText}>{unlockBanner}</Text>
                  <View style={styles.musicUpsellBtn}>
                    <Text style={styles.musicUpsellBtnText}>{upgradeLabel}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { activeEvent, events, setActiveEvent } = useEvents();
  const { t, language } = useLanguage();
  const { isPro, showPaywall, subscription, isTrial } = usePlan();
  const { freeTracks, premiumTracks, loading: musicLoading, getAuto } = useMusic();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [duration, setDuration] = useState(10);
  const [selectedEffect, setSelectedEffect] = useState<VideoPreset>(DEFAULT_PRESET);
  const effect: VideoPreset = selectedEffect;
  const [musicSelection, setMusicSelection] = useState<MusicSelection>(MUSIC_AUTO_ID);
  const [showSheet, setShowSheet] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [showNoEventTooltip, setShowNoEventTooltip] = useState(false);
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const btnScale = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const outerGlowScale = useRef(new Animated.Value(1)).current;
  const outerGlowOpacity = useRef(new Animated.Value(0.25)).current;
  const kioskBadgeOpacity = useRef(new Animated.Value(0)).current;

  const autoTrack = getAuto(effect, isPro);
  const allTracks = [...freeTracks, ...premiumTracks];
  const activeEffect = UI_EFFECTS.find(e => e.id === selectedEffect) ?? UI_EFFECTS[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(outerGlowScale, { toValue: 1.15, duration: 1800, useNativeDriver: true }),
          Animated.timing(outerGlowScale, { toValue: 1, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(outerGlowOpacity, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
          Animated.timing(outerGlowOpacity, { toValue: 0.1, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }, 600);
  }, [glowScale, glowOpacity, outerGlowScale, outerGlowOpacity]);

  useEffect(() => {
    Animated.timing(kioskBadgeOpacity, {
      toValue: kioskMode ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [kioskMode, kioskBadgeOpacity]);

  const hasActiveEvent = Boolean(activeEvent);

  const showNoEventHint = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setShowNoEventTooltip(true);
    Animated.timing(tooltipOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    tooltipTimer.current = setTimeout(() => {
      Animated.timing(tooltipOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setShowNoEventTooltip(false)
      );
    }, 2500);
  }, [tooltipOpacity]);

  const handlePressIn = () => {
    if (!hasActiveEvent) return;
    Animated.spring(btnScale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 30,
      bounciness: 5,
    }).start();
    if (Platform.OS !== 'web') {
      try { Haptics.selectionAsync(); } catch {}
    }
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handleStartRecording = async () => {
    if (!hasActiveEvent) {
      showNoEventHint();
      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
      }
      return;
    }
    if (Platform.OS !== 'web') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    }

    const effectiveDuration = (!isPro && duration > 10) ? 10 : duration;

    router.push({
      pathname: '/recording',
      params: {
        duration: String(effectiveDuration),
        effect,
        eventId: activeEvent.id,
        eventName: activeEvent.name,
        eventColor: activeEvent.color,
        logoUrl: activeEvent.logoUri || '',
        kioskMode: kioskMode ? '1' : '0',
        musicSelection,
        frameCloudinaryId: activeEvent.frameCloudinaryId || '',
      },
    });
  };

  const toggleKiosk = () => {
    setKioskMode(v => !v);
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
  };

  const handleEffectSelect = (effectId: VideoPreset) => {
    if (!isPro && (effectId === 'cinematic' || effectId === 'hype')) {
      showPaywall(effectId === 'cinematic' ? 'cinematic' : 'hype');
      return;
    }
    setSelectedEffect(effectId);
  };

  const handleDurationSelect = (d: number) => {
    if (!isPro && d > 10) {
      showPaywall('duration');
      return;
    }
    setDuration(d);
  };

  const openSheet = () => {
    if (Platform.OS !== 'web') {
      try { Haptics.selectionAsync(); } catch {}
    }
    setShowSheet(true);
  };

  const getMusicSummary = () => {
    if (musicSelection === MUSIC_NONE_ID) return '🔇 ' + t.music.none;
    if (musicSelection === MUSIC_AUTO_ID) return '🎵 ' + t.music.auto;
    const track = allTracks.find(tr => tr.id === musicSelection);
    return track ? `${track.emoji} ${track.title}` : '🎵 ' + t.music.auto;
  };

  const subscriptionBanner = React.useMemo(() => {
    if (!isPro && !isTrial) return null;
    if (isTrial) {
      const days = getTrialRemainingDays(subscription.trialStartAt);
      const msgs: Record<string, string> = {
        pt: `Teste grátis: ${days} dias restantes`,
        en: `Free trial: ${days} days left`,
        es: `Prueba gratuita: ${days} días restantes`,
      };
      return { type: 'trial' as const, days, label: msgs[language] ?? msgs.pt };
    }
    if (subscription.status === 'active' && subscription.expiresAt) {
      const expiry = formatExpiryDate(subscription.expiresAt, language);
      const msgs: Record<string, string> = {
        pt: `Pro ativo até ${expiry}`,
        en: `Pro active until ${expiry}`,
        es: `Pro activo hasta ${expiry}`,
      };
      return { type: 'pro' as const, expiresAt: expiry, label: msgs[language] ?? msgs.pt };
    }
    return null;
  }, [isPro, isTrial, subscription, language]);

  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      {subscriptionBanner && (
        <Pressable
          style={[
            styles.subscriptionBanner,
            { top: insets.top + 6 },
            subscriptionBanner.type === 'trial'
              ? styles.subscriptionBannerTrial
              : styles.subscriptionBannerPro,
          ]}
          onPress={() => {
            if (subscriptionBanner.type === 'trial') {
              showPaywall('generic');
            } else {
              router.push('/subscription');
            }
          }}
        >
          <LinearGradient
            colors={
              subscriptionBanner.type === 'trial'
                ? ['#F59E0B18', '#EF444418']
                : ['#10B98118', '#05966918']
            }
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.subscriptionBannerGrad}
          >
            <MaterialIcons
              name={subscriptionBanner.type === 'trial' ? 'celebration' : 'star'}
              size={13}
              color={subscriptionBanner.type === 'trial' ? '#F59E0B' : '#10B981'}
            />
            <Text
              style={[
                styles.subscriptionBannerText,
                { color: subscriptionBanner.type === 'trial' ? '#F59E0B' : '#10B981' },
              ]}
              numberOfLines={1}
            >
              {subscriptionBanner.label}
            </Text>
            {subscriptionBanner.type === 'trial' && (
              <View style={styles.subscriptionBannerCta}>
                <Text style={styles.subscriptionBannerCtaText}>
                  {language === 'en' ? 'Subscribe now' : language === 'es' ? 'Suscribirse' : 'Assinar agora'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>
      )}

      <Animated.View style={[styles.kioskBanner, { opacity: kioskBadgeOpacity }]}>
        <MaterialIcons name="tv" size={12} color="#10B981" />
        <Text style={styles.kioskBannerText}>{t.home.kioskBanner}</Text>
      </Animated.View>

      <View
        style={[
          styles.screen,
          {
            paddingTop:
              insets.top +
              (kioskMode ? 48 : Spacing.md) +
              (subscriptionBanner ? 44 : 0),
            paddingBottom: insets.bottom + 80,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            style={[
              styles.eventChip,
              { borderColor: (activeEvent?.color || Colors.Primary) + '55' },
            ]}
            onPress={() => setShowEventPicker(v => !v)}
            hitSlop={8}
          >
            <View
              style={[
                styles.eventDot,
                { backgroundColor: activeEvent?.color || Colors.TextMuted },
              ]}
            />
            <Text style={styles.eventChipText} numberOfLines={1}>
              {activeEvent?.name || t.home.selectEvent}
            </Text>
            <MaterialIcons
              name={showEventPicker ? 'expand-less' : 'expand-more'}
              size={16}
              color={Colors.TextSubtle}
            />
          </Pressable>

          {isPro && (
            <View style={styles.proBadge}>
              <MaterialIcons name="star" size={11} color="#F59E0B" />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>

        {showEventPicker && (
          <View style={styles.eventDropdown}>
            {events.map(ev => (
              <Pressable
                key={ev.id}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  activeEvent?.id === ev.id && {
                    backgroundColor: ev.color + '18',
                    borderColor: ev.color + '55',
                  },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  setActiveEvent(ev);
                  setShowEventPicker(false);
                }}
              >
                <View style={[styles.pickerDot, { backgroundColor: ev.color }]} />
                <Text style={styles.dropdownItemText}>{ev.name}</Text>
                {activeEvent?.id === ev.id && (
                  <MaterialIcons name="check-circle" size={16} color={ev.color} />
                )}
              </Pressable>
            ))}

            <Pressable
              style={({ pressed }) => [
                styles.dropdownNewItem,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                setShowEventPicker(false);
                router.push('/create-event');
              }}
            >
              <MaterialIcons name="add" size={18} color={Colors.Primary} />
              <Text style={styles.dropdownNewText}>{t.home.newEvent}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.centerArea}>
          <View style={styles.recordStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.outerRing,
                { transform: [{ scale: outerGlowScale }], opacity: outerGlowOpacity },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.innerRing,
                { transform: [{ scale: glowScale }], opacity: glowOpacity },
              ]}
            />

            {showNoEventTooltip && (
              <Animated.View style={[styles.noEventTooltip, { opacity: tooltipOpacity }]}>
                <MaterialIcons name="info-outline" size={14} color="#FEF3C7" />
                <Text style={styles.noEventTooltipText}>
                  {language === 'en'
                    ? 'Select or create an event first'
                    : language === 'es'
                    ? 'Selecciona o crea un evento primero'
                    : 'Selecione ou crie um evento primeiro'}
                </Text>
              </Animated.View>
            )}

            <Animated.View style={{ transform: [{ scale: btnScale }], zIndex: 2 }}>
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleStartRecording}
              >
                <LinearGradient
                  colors={hasActiveEvent
                    ? ['#C084FC', '#8B5CF6', '#4F46E5']
                    : ['#3D3A5C', '#2A2845', '#1E1B3A']}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={[styles.recordBtn, !hasActiveEvent && styles.recordBtnDisabled]}
                >
                  <MaterialIcons
                    name="videocam"
                    size={50}
                    color={hasActiveEvent ? '#fff' : 'rgba(255,255,255,0.3)'}
                  />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.recordLabelBlock}>
            <Text style={[styles.recordLabel, !hasActiveEvent && { color: Colors.TextMuted }]}>
              {t.home.recordNow}
            </Text>
            {!hasActiveEvent ? (
              <Pressable
                style={styles.noEventHint}
                onPress={() => setShowEventPicker(true)}
                hitSlop={8}
              >
                <MaterialIcons name="event" size={13} color={Colors.Warning} />
                <Text style={styles.noEventHintText}>
                  {language === 'en'
                    ? 'Select or create an event'
                    : language === 'es'
                    ? 'Selecciona o crea un evento'
                    : 'Selecione ou crie um evento'}
                </Text>
                <MaterialIcons name="chevron-right" size={13} color={Colors.Warning} />
              </Pressable>
            ) : (
              <View style={styles.recordMetaRow}>
                <Text style={styles.recordMeta}>
                  {activeEffect.emoji} {activeEffect.label}
                </Text>
                <View style={styles.metaSep} />
                <MaterialIcons name="timer" size={13} color={Colors.TextSubtle} />
                <Text style={styles.recordMeta}>{duration}s</Text>
                {musicSelection !== MUSIC_NONE_ID && (
                  <>
                    <View style={styles.metaSep} />
                    <MaterialIcons name="music-note" size={13} color={Colors.TextSubtle} />
                  </>
                )}
                {kioskMode && (
                  <>
                    <View style={styles.metaSep} />
                    <MaterialIcons name="tv" size={13} color={Colors.Success} />
                    <Text style={[styles.recordMeta, { color: Colors.Success }]}>
                      {t.home.autoSuffix}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomArea}>
          <View
            style={[
              styles.kioskRow,
              kioskMode && {
                borderColor: Colors.Success + '55',
                backgroundColor: Colors.Success + '0A',
              },
            ]}
          >
            <View style={styles.kioskLeft}>
              <MaterialIcons
                name="tv"
                size={18}
                color={kioskMode ? Colors.Success : Colors.TextMuted}
              />
              <View>
                <Text
                  style={[
                    styles.kioskLabel,
                    kioskMode && { color: Colors.Success },
                  ]}
                >
                  {t.home.kioskMode}
                </Text>
                <Text style={styles.kioskSub}>{t.home.kioskSub}</Text>
              </View>
            </View>

            <Switch
              value={kioskMode}
              onValueChange={toggleKiosk}
              trackColor={{ false: Colors.Border, true: Colors.Success + '66' }}
              thumbColor={kioskMode ? Colors.Success : Colors.TextMuted}
              ios_backgroundColor={Colors.Border}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.configBtn, { opacity: pressed ? 0.75 : 1 }]}
            onPress={openSheet}
            hitSlop={8}
          >
            <LinearGradient colors={['#1E1B3A', '#12102A']} style={styles.configBtnInner}>
              <MaterialIcons name="tune" size={16} color={Colors.TextSubtle} />
              <View style={styles.configBtnInfo}>
                <Text style={styles.configBtnLabel}>{t.home.quickConfig}</Text>
                <Text style={styles.configBtnValue}>
                  {activeEffect.emoji} {activeEffect.label} · {duration}s · {getMusicSummary()}
                </Text>
              </View>
              <MaterialIcons
                name="keyboard-arrow-up"
                size={18}
                color={Colors.TextMuted}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <ConfigSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        duration={duration}
        setDuration={handleDurationSelect}
        selectedEffect={selectedEffect}
        setSelectedEffect={handleEffectSelect}
        musicSelection={musicSelection}
        setMusicSelection={setMusicSelection}
        isPro={isPro}
        onUpgrade={() => {
          setShowSheet(false);
          showPaywall();
        }}
        freeTracks={freeTracks}
        premiumTracks={premiumTracks}
        musicLoading={musicLoading}
        autoTrack={autoTrack}
        labels={{
          sheetTitle: t.home.quickConfig,
          durationLabel: t.home.finalDuration,
          musicLabel: t.music.sectionLabel,
          autoMusicLabel: t.music.auto,
          autoMusicSub: t.music.autoSub,
          noMusicLabel: t.music.none,
          noMusicSub: t.music.noneSub,
          lockedLabel: t.music.locked,
          unlockBanner: t.music.unlockBanner,
          upgradeLabel: t.music.upgrade,
          libraryLabel: t.music.library,
          loadingTracksLabel: t.music.loadingTracks,
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb1: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#7C3AED',
    opacity: 0.06,
    top: -100,
    left: -80,
  },
  orb2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#EC4899',
    opacity: 0.05,
    bottom: 60,
    right: -60,
  },
  orb3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3B82F6',
    opacity: 0.04,
    top: '40%',
    right: -40,
  },

  kioskBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: Colors.Success + '18',
    borderBottomWidth: 1,
    borderBottomColor: Colors.Success + '44',
  },
  kioskBannerText: {
    color: Colors.Success,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },

  screen: { flex: 1, paddingHorizontal: Spacing.lg },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eventChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  eventDot: { width: 9, height: 9, borderRadius: 5 },
  eventChipText: {
    flex: 1,
    color: Colors.TextPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F59E0B18',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F59E0B44',
  },
  proBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  eventDropdown: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.Border,
    borderWidth: 1.5,
    borderColor: 'transparent',
    margin: 3,
    borderRadius: Radius.md,
  },
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  dropdownItemText: {
    flex: 1,
    color: Colors.TextPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  dropdownNewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  dropdownNewText: {
    color: Colors.Primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },

  recordStage: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  outerRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: '#8B5CF666',
    alignSelf: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 0,
  },
  innerRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#8B5CF6AA',
    alignSelf: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 0,
  },

  recordBtn: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 20,
  },
  recordBtnDisabled: {
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },

  noEventTooltip: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#92400E',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F59E0B55',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  noEventTooltipText: {
    color: '#FEF3C7',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  noEventHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.Warning + '18',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.Warning + '44',
    marginTop: 4,
  },
  noEventHintText: {
    color: Colors.Warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  recordLabelBlock: {
    alignItems: 'center',
    marginTop: 6,
    paddingBottom: Spacing.lg,
    gap: 6,
    maxWidth: 320,
  },
  recordLabel: {
    fontSize: 26,
    fontWeight: FontWeight.extrabold,
    color: Colors.TextPrimary,
    letterSpacing: 0.3,
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  recordMeta: { color: Colors.TextSubtle, fontSize: FontSize.sm },
  metaSep: { width: 1, height: 12, backgroundColor: Colors.Border, marginHorizontal: 2 },

  bottomArea: {
    gap: Spacing.sm,
    marginTop: 'auto',
    marginBottom: Spacing.sm,
  },

  kioskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  kioskLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  kioskLabel: {
    color: Colors.TextSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  kioskSub: { color: Colors.TextMuted, fontSize: 11, marginTop: 1 },

  configBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
  configBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.Border,
    borderRadius: Radius.lg,
  },
  configBtnInfo: { flex: 1 },
  configBtnLabel: {
    color: Colors.TextMuted,
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  configBtnValue: {
    color: Colors.TextSubtle,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,5,15,0.75)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16143A',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.Border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
    flexDirection: 'column',
  },
  sheetFixed: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.Border,
    marginBottom: Spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.TextPrimary,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
  },

  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  tabBtnActive: { backgroundColor: Colors.Primary },
  tabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.TextMuted,
  },
  tabTextActive: { color: '#fff' },

  sheetSection: { gap: Spacing.sm, marginTop: 2 },
  sheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetSectionLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.TextMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  segmentedGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
    height: 44,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: Colors.Border,
  },
  segmentFirst: { borderLeftWidth: 0 },
  segmentLast: { borderRightWidth: 0 },
  segmentActive: {
    shadowColor: Colors.Primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.TextMuted,
  },
  segmentTextActive: { color: '#fff', fontWeight: FontWeight.bold },
  segmentLockIcon: {
    position: 'absolute', top: 4, right: 5,
  },

  effectsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },

  effectsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  effectCard: {
    flex: 1,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.Border,
    padding: 8,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  effectPreviewStage: {
    height: 92,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#0D0820',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectPreviewGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    zIndex: 1,
  },
  effectPreviewShimmer: {
    position: 'absolute',
    width: 28,
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 2,
  },
  effectPreviewFrame: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 12,
    right: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  effectPreviewFrameLine: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderRadius: 12,
  },
  effectPreviewEmoji: { fontSize: 24 },
  effectLockOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: Radius.md,
  },
  effectLabel: {
    fontSize: 11,
    color: Colors.TextMuted,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: 2,
  },

  effectDesc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  effectDescDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3, flexShrink: 0 },
  effectDescText: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.TextSubtle,
  },
  effectDescName: { fontWeight: FontWeight.semibold },
  effectDescSub: { fontWeight: '400', color: Colors.TextSubtle },

  effectHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.Border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  effectHintText: {
    flex: 1,
    color: Colors.TextMuted,
    fontSize: 11,
    lineHeight: 16,
  },

  musicScroll: { flex: 1, minHeight: 0, paddingHorizontal: Spacing.lg },

  musicSpecialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.Border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  musicSpecialCardActive: {
    borderColor: Colors.Primary + '88',
    backgroundColor: Colors.Primary + '0A',
  },
  musicSpecialCardNone: {
    borderColor: Colors.Border,
    opacity: 0.8,
  },
  musicSpecialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicSpecialInfo: { flex: 1 },
  musicSpecialTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.TextPrimary,
  },
  musicSpecialSub: { fontSize: 11, color: Colors.TextMuted, marginTop: 2 },

  musicDivider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: 4 },
  musicDividerLine: { flex: 1, height: 1, backgroundColor: Colors.Border },
  musicDividerText: {
    fontSize: 10,
    color: Colors.TextMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
  },

  musicLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  musicLoadingText: { color: Colors.TextMuted, fontSize: FontSize.sm },

  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.Border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  musicCardLocked: { opacity: 0.6 },
  musicEmojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicEmoji: { fontSize: 18 },
  musicInfo: { flex: 1 },
  musicTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.TextPrimary,
  },
  musicTitleLocked: { color: Colors.TextMuted },
  musicMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  musicCategory: { fontSize: 11 },
  musicBpm: { fontSize: 11, color: Colors.TextMuted },
  lockWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.Border + '55',
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  musicUpsellBanner: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.Primary + '33',
  },
  musicUpsellBannerBg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  musicUpsellText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.TextSubtle,
    lineHeight: 18,
  },
  musicUpsellBtn: {
    backgroundColor: Colors.Primary,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  musicUpsellBtnText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold },

  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.Surface,
    borderWidth: 1,
    borderColor: Colors.Border,
    marginRight: 4,
  },

  previewIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.Primary + '12',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.Primary + '30',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.Primary,
  },
  previewIndicatorText: {
    flex: 1,
    fontSize: 11,
    color: Colors.TextSubtle,
    fontWeight: FontWeight.medium,
  },

  subscriptionBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 49,
    borderRadius: 999,
    overflow: 'hidden',
  },
  subscriptionBannerTrial: {
    borderWidth: 1,
    borderColor: '#F59E0B33',
  },
  subscriptionBannerPro: {
    borderWidth: 1,
    borderColor: '#10B98133',
  },
  subscriptionBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  subscriptionBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  subscriptionBannerCta: {
    backgroundColor: '#F59E0B',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subscriptionBannerCtaText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
});