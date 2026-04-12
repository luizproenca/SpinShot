import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, RefreshControl, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useVideos } from '../../hooks/useVideos';
import { useEvents } from '../../hooks/useEvents';
import { usePlan } from '../../hooks/usePlan';
import { useLanguage } from '../../hooks/useLanguage';
import { Video } from '../../services/types';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { PRESET_CONFIGS } from '../../services/videoEffectsService';
import * as Haptics from 'expo-haptics';

const THUMB_BLURHASH = 'LGFFaXYk^6#M@-5c,1J5@[or[Q6.';

// ─── Video Thumbnail ───────────────────────────────────────────────────────
function VideoThumb({ video, size = 72 }: { video: Video; size?: number }) {
  const presetInfo = PRESET_CONFIGS.boomerang;
  const colors: [string, string] = [video.eventColor + '55', video.eventColor + '18'];
  const iconSize = size <= 72 ? 14 : 20;

  if (video.thumbnailUri) {
    return (
      <View style={[styles.thumb, { width: size, height: size, borderRadius: Radius.md }]}>
        <Image
          source={{ uri: video.thumbnailUri }}
          style={{ width: size, height: size, borderRadius: Radius.md }}
          contentFit="cover"
          transition={300}
          placeholder={{ blurhash: THUMB_BLURHASH }}
          placeholderContentFit="cover"
          recyclingKey={video.id}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={[StyleSheet.absoluteFillObject, { borderRadius: Radius.md }]}
          pointerEvents="none"
        />
        <View style={[styles.thumbColorBar, { backgroundColor: video.eventColor }]} />
        <View style={styles.thumbPlayOverlay}>
          <View style={styles.thumbPlayCircle}>
            <MaterialIcons name="play-arrow" size={iconSize + 4} color="rgba(255,255,255,0.95)" />
          </View>
        </View>
        {video.effect && (
          <View style={styles.thumbEffectBadge}>
            <Text style={styles.thumbEffectEmoji}>{presetInfo?.emoji || ''}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <LinearGradient colors={colors} style={[styles.thumb, { width: size, height: size, borderRadius: Radius.md }]}>
      <View style={[styles.thumbColorBar, { backgroundColor: video.eventColor }]} />
      <Text style={[styles.thumbEmoji, { fontSize: size === 72 ? 24 : 32 }]}>
        {presetInfo?.emoji || '🔁'}
      </Text>
      <View style={styles.thumbPlayOverlay}>
        <View style={styles.thumbPlayCircle}>
          <MaterialIcons name="play-arrow" size={iconSize} color="rgba(255,255,255,0.85)" />
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── Featured (Latest) Card ────────────────────────────────────────────────
function FeaturedCard({
  video,
  onPreview,
  onShare,
  onDelete,
  latestLabel,
}: {
  video: Video;
  onPreview: () => void;
  onShare: () => void;
  onDelete: () => void;
  latestLabel: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const presetInfo = PRESET_CONFIGS.boomerang;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 60 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const date = new Date(video.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Animated.View style={[styles.featuredWrap, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPreview}
        onLongPress={onDelete}
        delayLongPress={600}
      >
        <LinearGradient
          colors={[video.eventColor + '22', '#13103A']}
          style={[styles.featuredCard, { borderColor: video.eventColor + '55' }]}
        >
          {/* Thumbnail large */}
          <View style={styles.featuredThumbWrap}>
            <VideoThumb video={video} size={104} />
          </View>

          {/* Info */}
          <View style={styles.featuredInfo}>
            <View style={styles.newBadge}>
              <View style={[styles.newDot, { backgroundColor: Colors.Success }]} />
              <Text style={styles.newBadgeText}>{latestLabel.toUpperCase()}</Text>
            </View>

            <Text style={styles.featuredName} numberOfLines={2}>{video.eventName}</Text>

            <View style={styles.featuredMeta}>
              <View style={[styles.effectChip, { backgroundColor: video.eventColor + '22', borderColor: video.eventColor + '44' }]}>
                <Text style={[styles.effectChipText, { color: video.eventColor }]}>
                  {presetInfo?.emoji} {presetInfo?.label || video.effect}
                </Text>
              </View>
            </View>

            <View style={styles.featuredMetaRow}>
              <MaterialIcons name="timer" size={12} color={Colors.TextSubtle} />
              <Text style={styles.featuredMetaText}>{video.duration}s</Text>
              <Text style={styles.featuredMetaDot}>·</Text>
              <Text style={styles.featuredMetaText}>{dateStr}</Text>
              {video.downloads > 0 && (
                <>
                  <Text style={styles.featuredMetaDot}>·</Text>
                  <MaterialIcons name="download" size={12} color={Colors.TextSubtle} />
                  <Text style={styles.featuredMetaText}>{video.downloads}</Text>
                </>
              )}
            </View>
          </View>

          {/* CTA */}
          <View style={styles.featuredCta}>
            <Pressable
              onPress={e => { e.stopPropagation?.(); onShare(); }}
              hitSlop={8}
            >
              <LinearGradient
                colors={[video.eventColor, video.eventColor + 'AA']}
                style={styles.featuredCtaBtn}
              >
                <MaterialIcons name="qr-code" size={24} color="#fff" />
              </LinearGradient>
            </Pressable>
            <Text style={[styles.featuredCtaLabel, { color: video.eventColor }]}>QR Code</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Regular Video Card ────────────────────────────────────────────────────
function VideoCard({
  video,
  onPreview,
  onShare,
  onDelete,
}: {
  video: Video;
  onPreview: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const presetInfo = PRESET_CONFIGS.boomerang;
  const date = new Date(video.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 60 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPreview}>
        <View style={[styles.card, { borderColor: video.eventColor + '33' }]}>
          <View style={[styles.cardAccent, { backgroundColor: video.eventColor }]} />

          <VideoThumb video={video} size={68} />

          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{video.eventName}</Text>

            <View style={styles.cardEffectRow}>
              <Text style={styles.cardEffectEmoji}>{presetInfo?.emoji || '🔁'}</Text>
              <Text style={styles.cardEffectText}>{presetInfo?.label || video.effect}</Text>
            </View>

            <View style={styles.cardMeta}>
              <MaterialIcons name="timer" size={11} color={Colors.TextMuted} />
              <Text style={styles.cardMetaText}>{video.duration}s</Text>
              <Text style={styles.cardMetaDot}>·</Text>
              <Text style={styles.cardMetaText}>{dateStr}</Text>
              <Text style={styles.cardMetaDot}>·</Text>
              <Text style={styles.cardMetaText}>{timeStr}</Text>
              {video.downloads > 0 && (
                <>
                  <Text style={styles.cardMetaDot}>·</Text>
                  <MaterialIcons name="download" size={11} color={Colors.TextMuted} />
                  <Text style={styles.cardMetaText}>{video.downloads}</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.cardActions}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.shareBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={e => { e.stopPropagation?.(); onShare(); }}
              hitSlop={6}
            >
              <MaterialIcons name="qr-code" size={17} color={Colors.Primary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.deleteBtnStyle, { opacity: pressed ? 0.7 : 1 }]}
              onPress={e => { e.stopPropagation?.(); onDelete(); }}
              hitSlop={6}
            >
              <MaterialIcons name="delete-outline" size={17} color={Colors.Error} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────
function FilterChip({
  label, color, isSelected, onPress,
}: {
  label: string; color?: string; isSelected: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        isSelected
          ? { backgroundColor: color || Colors.Primary, borderColor: color || Colors.Primary }
          : { backgroundColor: Colors.SurfaceElevated, borderColor: Colors.Border },
      ]}
    >
      {color && !isSelected && <View style={[styles.filterDot, { backgroundColor: color }]} />}
      <Text style={[
        styles.filterChipText,
        isSelected ? { color: '#fff' } : { color: Colors.TextSubtle },
      ]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function VideosScreen() {
  const { videos, isLoading, refreshVideos, deleteVideo } = useVideos();
  const { events } = useEvents();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { isPro, showPaywall } = usePlan();
  const { t } = useLanguage();

  const [search, setSearch] = useState('');
  const [filterEventId, setFilterEventId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshVideos();
    setRefreshing(false);
  }, [refreshVideos]);

  const filtered = videos.filter(v => {
    const matchEvent = filterEventId ? v.eventId === filterEventId : true;
    const matchSearch = search.trim()
      ? v.eventName.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchEvent && matchSearch;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const latest = sorted[0];
  const rest = sorted.slice(1);

  const goPreview = (v: Video) => {
    const matchingEvent = events.find(e => e.id === v.eventId);
    router.push({
      pathname: '/preview',
      params: {
        shareUrl: v.shareUrl || '',
        effect: v.effect || 'boomerang',
        eventName: v.eventName,
        eventColor: v.eventColor,
        logoUrl: matchingEvent?.logoUri || '',
        duration: String(v.duration),
        thumbnailUri: v.thumbnailUri || '',
        localVideoUri: v.videoUri || '',
        kioskMode: '0',
      },
    });
  };

  const goShare = (v: Video) => {
    const matchingEvent = events.find(e => e.id === v.eventId);
    router.push({
      pathname: '/share',
      params: {
        shareUrl: v.shareUrl,
        eventName: v.eventName,
        eventColor: v.eventColor,
        logoUrl: matchingEvent?.logoUri || '',
      },
    });
  };

  const goWatermark = () => showPaywall('watermark');

  const confirmDelete = (v: Video) => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    showAlert(
      t.videos.deleteVideo,
      t.videos.deleteVideoSub.replace('{{name}}', v.eventName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVideo(v.id);
              if (Platform.OS !== 'web') {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
              }
            } catch (e: any) {
              showAlert(t.common.error, e.message);
            }
          },
        },
      ]
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>{t.videos.title}</Text>
          <Text style={styles.subtitle}>
            {filtered.length} {t.videos.recorded.toLowerCase()}
          </Text>
        </View>
        <Pressable
          onPress={onRefresh}
          style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          <MaterialIcons name="refresh" size={22} color={Colors.TextSubtle} />
        </Pressable>
      </View>

      {videos.length > 0 && (
        <View style={styles.statsStrip}>
          <LinearGradient colors={['#7C3AED22', '#4F46E522']} style={styles.statItem}>
            <MaterialIcons name="videocam" size={18} color={Colors.Primary} />
            <Text style={styles.statValue}>{videos.length}</Text>
            <Text style={styles.statLabel}>{t.videos.recorded}</Text>
          </LinearGradient>
          <LinearGradient colors={['#EC489922', '#7C3AED22']} style={styles.statItem}>
            <MaterialIcons name="download" size={18} color={Colors.Secondary} />
            <Text style={styles.statValue}>{videos.reduce((a, v) => a + (v.downloads || 0), 0)}</Text>
            <Text style={styles.statLabel}>{t.videos.downloads}</Text>
          </LinearGradient>
          <LinearGradient colors={['#10B98122', '#3B82F622']} style={styles.statItem}>
            <MaterialIcons name="celebration" size={18} color={Colors.Success} />
            <Text style={styles.statValue}>{new Set(videos.map(v => v.eventId)).size}</Text>
            <Text style={styles.statLabel}>{t.videos.events}</Text>
          </LinearGradient>
        </View>
      )}

      {!isPro && videos.length > 0 && (
        <Pressable
          onPress={goWatermark}
          style={({ pressed }) => [styles.upsellBanner, { opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={['#7C3AED1A', '#EC48991A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.upsellBannerGrad}
          >
            <View style={styles.upsellBannerLeft}>
              <MaterialIcons name="hide-source" size={18} color={Colors.Primary} />
              <View>
                <Text style={styles.upsellBannerTitle}>{t.videos.upsellTitle}</Text>
                <Text style={styles.upsellBannerSub}>{t.videos.upsellSub}</Text>
              </View>
            </View>
            <View style={styles.upsellBannerBtn}>
              <Text style={styles.upsellBannerBtnText}>{t.videos.seePlans}</Text>
              <MaterialIcons name="arrow-forward" size={13} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color={Colors.TextMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.videos.searchPlaceholder}
          placeholderTextColor={Colors.TextMuted}
          accessibilityLabel={t.videos.searchPlaceholder}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={Colors.TextMuted} />
          </Pressable>
        )}
      </View>

      {events.length > 1 && (
        <View style={styles.filterRow}>
          <FilterChip label={t.videos.all} isSelected={filterEventId === null} onPress={() => setFilterEventId(null)} />
          {events.map(ev => (
            <FilterChip
              key={ev.id}
              label={ev.name}
              color={ev.color}
              isSelected={filterEventId === ev.id}
              onPress={() => setFilterEventId(filterEventId === ev.id ? null : ev.id)}
            />
          ))}
        </View>
      )}

      {latest && (
        <>
          <Text style={styles.sectionLabel}>{t.videos.latest}</Text>
          <FeaturedCard
            video={latest}
            onPreview={() => goPreview(latest)}
            onShare={() => goShare(latest)}
            onDelete={() => confirmDelete(latest)}
            latestLabel={t.videos.latest}
          />
        </>
      )}

      {rest.length > 0 && (
        <Text style={[styles.sectionLabel, { marginTop: Spacing.sm }]}>
          {t.videos.previous} ({rest.length})
        </Text>
      )}
    </View>
  );

  const Empty = () => (
    <View style={styles.emptyState}>
      <LinearGradient colors={['#7C3AED18', '#0D0820']} style={styles.emptyIconWrap}>
        <MaterialIcons name="video-library" size={52} color={Colors.Primary + '88'} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>
        {search || filterEventId ? t.videos.noResults : t.videos.noVideos}
      </Text>
      <Text style={styles.emptySubtitle}>
        {search
          ? t.videos.noResultsSub.replace('{{q}}', search)
          : filterEventId
          ? t.videos.noEventVideos
          : t.videos.noVideosSubtitle}
      </Text>
      {(search || filterEventId) && (
        <Pressable
          style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => { setSearch(''); setFilterEventId(null); }}
        >
          <Text style={styles.clearBtnText}>{t.videos.clearFilters}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      <FlatList
        data={rest}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.Primary}
            colors={[Colors.Primary]}
          />
        }
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={latest ? null : <Empty />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            onPreview={() => goPreview(item)}
            onShare={() => goShare(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: Spacing.lg },

  listHeader: { gap: Spacing.md, marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  subtitle: { color: Colors.TextSubtle, fontSize: FontSize.sm, marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1, borderColor: Colors.Border,
    alignItems: 'center', justifyContent: 'center',
  },

  statsStrip: { flexDirection: 'row', gap: Spacing.sm },
  statItem: {
    flex: 1, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.Border,
    padding: Spacing.md, alignItems: 'center', gap: 3,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  statLabel: { fontSize: 10, color: Colors.TextSubtle, textAlign: 'center' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border,
    paddingHorizontal: Spacing.md, height: 46,
  },
  searchInput: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    maxWidth: 140,
  },
  filterDot: { width: 7, height: 7, borderRadius: 4 },
  filterChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.TextMuted, textTransform: 'uppercase', letterSpacing: 1,
  },

  featuredWrap: {
    borderRadius: Radius.xl, overflow: 'hidden',
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  featuredCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.md,
    borderWidth: 1.5, borderRadius: Radius.xl,
  },
  featuredThumbWrap: {
    borderRadius: Radius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  featuredInfo: { flex: 1, gap: 6 },
  newBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: Colors.Border,
  },
  newDot: { width: 6, height: 6, borderRadius: 3 },
  newBadgeText: { color: Colors.TextSubtle, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  featuredName: { color: Colors.TextPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold, lineHeight: 22 },
  featuredMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  effectChip: {
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  effectChipText: { fontSize: 11, fontWeight: FontWeight.semibold },
  featuredMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  featuredMetaText: { color: Colors.TextSubtle, fontSize: 11 },
  featuredMetaDot: { color: Colors.TextMuted, fontSize: 11 },
  featuredCta: { alignItems: 'center', gap: 5 },
  featuredCtaBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  featuredCtaLabel: { fontSize: 10, fontWeight: FontWeight.bold },

  thumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  thumbColorBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2 },
  thumbEmoji: { fontSize: 24 },
  thumbPlayOverlay: {
    position: 'absolute', bottom: 0, right: 0, left: 0, top: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbPlayCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  thumbEffectBadge: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1,
  },
  thumbEffectEmoji: { fontSize: 9 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, overflow: 'hidden', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingRight: Spacing.sm,
  },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  cardEffectRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardEffectEmoji: { fontSize: 11 },
  cardEffectText: { color: Colors.TextSubtle, fontSize: 11 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  cardMetaText: { color: Colors.TextMuted, fontSize: 10 },
  cardMetaDot: { color: Colors.TextMuted, fontSize: 10 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { backgroundColor: Colors.Primary + '22' },
  deleteBtnStyle: { backgroundColor: Colors.Error + '15' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: Spacing.md },
  emptyIconWrap: {
    width: 108, height: 108, borderRadius: 54,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border, marginBottom: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.TextSubtle, textAlign: 'center', lineHeight: 22 },
  clearBtn: {
    marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.Border,
  },
  clearBtnText: { color: Colors.Primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  upsellBanner: { borderRadius: Radius.lg, overflow: 'hidden' },
  upsellBannerGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing.sm, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.Primary + '33', borderRadius: Radius.lg,
  },
  upsellBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  upsellBannerTitle: { color: Colors.TextPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  upsellBannerSub: { color: Colors.TextMuted, fontSize: 10, marginTop: 1 },
  upsellBannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.Primary, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  upsellBannerBtnText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },
});
