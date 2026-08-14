import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Animated, RefreshControl, Platform, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useEvents } from '../../hooks/useEvents';
import { useFrames } from '../../hooks/useFrames';
import { useMusic } from '../../hooks/useMusic';
import { usePlan } from '../../hooks/usePlan';
import { useLanguage } from '../../hooks/useLanguage';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Event } from '../../services/types';
import { getEventUnlockStatus, toLocalDateString } from '../../services/eventService';
import { MUSIC_AUTO_ID, MUSIC_NONE_ID } from '../../constants/music';

function EventListCard({
  event,
  isActive,
  onActivate,
  onDelete,
  onEdit,
  onRefreshCount,
  activeLabel,
  videosLabel,
  isPro,
}: {
  event: Event;
  isActive: boolean;
  onActivate: (e: Event) => void;
  onDelete: (e: Event) => void;
  onEdit: (e: Event) => void;
  onRefreshCount: (id: string) => void;
  activeLabel: string;
  videosLabel: string;
  isPro: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const { showPaywall } = usePlan();
  const { t } = useLanguage();

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onActivate(event)}
      >
        <View
          style={[
            styles.eventCard,
            isActive && {
              borderColor: event.color + 'AA',
              backgroundColor: event.color + '10',
            },
          ]}
        >
          <View style={[styles.cardAccent, { backgroundColor: event.color }]} />

          <View style={styles.eventMainRow}>
            <View style={[styles.logoWrap, { backgroundColor: event.color + '22', borderColor: event.color + '44' }]}>
              {event.logoUri ? (
                <Image source={{ uri: event.logoUri }} style={styles.logoImg} contentFit="cover" transition={200} />
              ) : (
                <MaterialIcons name="celebration" size={24} color={event.color} />
              )}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardTopLine}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {event.name}
                </Text>

                {isActive && (
                  <View style={[styles.activeBadge, { backgroundColor: event.color + '22', borderColor: event.color + '66' }]}>
                    <View style={[styles.activeDot, { backgroundColor: event.color }]} />
                    <Text style={[styles.activeBadgeText, { color: event.color }]}>
                      {activeLabel}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBottomLine}>
                <Pressable
                  style={styles.statChip}
                  onPress={(e) => {
                    e.stopPropagation();
                    onRefreshCount(event.id);
                  }}
                  hitSlop={6}
                >
                  <MaterialIcons name="videocam" size={13} color={Colors.TextSubtle} />
                  <Text style={styles.statChipText}>
                    {event.videoCount} {videosLabel}
                  </Text>
                  <MaterialIcons name="refresh" size={11} color={Colors.TextMuted} />
                </Pressable>

                {(event.eventDate || event.createdAt) && (
                  <Text style={styles.cardDate} numberOfLines={1}>
                    {new Date(event.eventDate || event.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                )}
              </View>

              {!isPro && (() => {
                const unlockStatus = getEventUnlockStatus(event);
                return (
                  <View style={styles.cardBottomLine}>
                    {unlockStatus === 'unlocked' && (
                      <View style={[styles.unlockChip, { backgroundColor: Colors.Success + '1A', borderColor: Colors.Success + '44' }]}>
                        <MaterialIcons name="lock-open" size={11} color={Colors.Success} />
                        <Text style={[styles.unlockChipText, { color: Colors.Success }]}>
                          {event.unlockSource === 'purchase' ? t.events.unlockedPaid : t.events.unlockedFree}
                        </Text>
                      </View>
                    )}
                    {unlockStatus === 'scheduled' && (
                      <View style={[styles.unlockChip, { backgroundColor: Colors.Secondary + '1A', borderColor: Colors.Secondary + '44' }]}>
                        <MaterialIcons name="schedule" size={11} color={Colors.Secondary} />
                        <Text style={[styles.unlockChipText, { color: Colors.Secondary }]}>
                          {t.events.unlockScheduled}
                        </Text>
                      </View>
                    )}
                    {unlockStatus === 'expired' && (
                      <View style={[styles.unlockChip, { backgroundColor: Colors.TextMuted + '1A', borderColor: Colors.TextMuted + '44' }]}>
                        <MaterialIcons name="history" size={11} color={Colors.TextSubtle} />
                        <Text style={[styles.unlockChipText, { color: Colors.TextSubtle }]}>
                          {t.events.unlockExpired}
                        </Text>
                      </View>
                    )}
                    {unlockStatus === 'locked' && (
                      <Pressable
                        style={[styles.unlockChip, { backgroundColor: Colors.Warning + '1A', borderColor: Colors.Warning + '44' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          // stopPropagation blocks the card's own onPress
                          // (which would call onActivate) — without this,
                          // PaywallModal's activeEvent stays whatever it
                          // was before, so the event-pass offer for THIS
                          // specific locked event never renders (App
                          // Store review rejection 2026-08-13, Guideline
                          // 2.1(b): couldn't find "Pacote de Evento").
                          onActivate(event);
                          showPaywall('event_limit');
                        }}
                      >
                        <MaterialIcons name="lock-outline" size={11} color={Colors.Warning} />
                        <Text style={[styles.unlockChipText, { color: Colors.Warning }]}>{t.events.locked}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })()}
            </View>
          </View>

          <View style={styles.cardActionsRow}>
            {isPro && (
              <Pressable
                style={[styles.cardActionBtn, styles.monitorActionBtn, { borderColor: event.color + '55' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/operator/${event.id}` as any);
                }}
                hitSlop={8}
              >
                <MaterialIcons name="desktop-windows" size={18} color={event.color} />
                <Text style={[styles.monitorActionText, { color: event.color }]}>Monitor</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.cardActionBtn}
              onPress={(e) => {
                e.stopPropagation();
                onEdit(event);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="edit" size={18} color={Colors.TextSubtle} />
            </Pressable>

            <Pressable
              style={styles.cardActionBtn}
              onPress={(e) => {
                e.stopPropagation();
                onDelete(event);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="delete-outline" size={18} color={Colors.TextMuted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function EventsScreen() {
  const { events, activeEvent, setActiveEvent, deleteEvent, updateEvent, refreshEvents, refreshVideoCount, isLoading, createEvent } = useEvents();
  const { frames, defaultFrames, isLoading: framesLoading } = useFrames();
  const { freeTracks, premiumTracks } = useMusic();
  const { isPro, showPaywall } = usePlan();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#8B5CF6');
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [showNewEventDatePicker, setShowNewEventDatePicker] = useState(false);
  const [newMusic, setNewMusic] = useState<string>(MUSIC_AUTO_ID);
  const [logoLocalUri, setLogoLocalUri] = useState<string | null>(null);
  const [newFrameId, setNewFrameId] = useState<string | null>(null);
  const [newFrameCloudinaryId, setNewFrameCloudinaryId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#8B5CF6');
  const [editLogoUri, setEditLogoUri] = useState<string | null>(null);
  const [editFrameId, setEditFrameId] = useState<string | null>(null);
  const [editFrameCloudinaryId, setEditFrameCloudinaryId] = useState<string | null>(null);
  const [editMusic, setEditMusic] = useState<string>(MUSIC_AUTO_ID);
  const [saving, setSaving] = useState(false);

  const editSheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(editSheetAnim, {
      toValue: showEditSheet ? 1 : 0,
      friction: 12, tension: 80, useNativeDriver: true,
    }).start();
  }, [showEditSheet]);

  const handleOpenEdit = (event: Event) => {
    setEditingEvent(event);
    setEditName(event.name);
    setEditColor(event.color);
    setEditLogoUri(event.logoUri || null);
    setEditFrameId(event.frameId || null);
    setEditFrameCloudinaryId(event.frameCloudinaryId || null);
    setEditMusic(event.music || MUSIC_AUTO_ID);
    setShowEditSheet(true);
  };

  const handlePickEditLogo = async () => {
    if (!isPro) { showPaywall('event_logo'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setEditLogoUri(result.assets[0].uri);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEvent || !editName.trim()) {
      showAlert(t.events.eventName, t.events.eventName + '.');
      return;
    }
    setSaving(true);
    try {
      const isNewLocalLogo = editLogoUri?.startsWith('file://');
      await updateEvent(editingEvent.id, {
        name: editName.trim(),
        color: editColor,
        logoLocalUri: isNewLocalLogo ? editLogoUri! : undefined,
        logoUri: isNewLocalLogo ? undefined : (editLogoUri || undefined),
        frameId: editFrameId || undefined,
        frameCloudinaryId: editFrameCloudinaryId || undefined,
        music: editMusic,
      });
      setShowEditSheet(false);
      setEditingEvent(null);
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectFrameForCreate = (frameId: string | null, cloudinaryId: string | null) => {
    setNewFrameId(frameId);
    setNewFrameCloudinaryId(cloudinaryId);
    if (Platform.OS !== 'web') { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }
  };

  const handleSelectFrameForEdit = (frameId: string | null, cloudinaryId: string | null) => {
    setEditFrameId(frameId);
    setEditFrameCloudinaryId(cloudinaryId);
    if (Platform.OS !== 'web') { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }
  };

  const EVENT_COLORS_LIST = [
    '#8B5CF6', '#EC4899', '#3B82F6', '#10B981',
    '#F59E0B', '#EF4444', '#14B8A6', '#F97316',
    '#6366F1', '#84CC16',
  ];

  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: showCreateSheet ? 1 : 0,
      friction: 12,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [showCreateSheet]);

  const filteredEvents = search.trim()
    ? events.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : events;

  const totalVideos = events.reduce((a, e) => a + (e.videoCount || 0), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshEvents();
    setRefreshing(false);
  };

  const handleActivate = (event: Event) => {
    setActiveEvent(event);
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
  };

  const handleDelete = (event: Event) => {
    showAlert(
      t.events.deleteEvent,
      `"${event.name}" ${t.events.deleteConfirm}`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(event.id);
            } catch (e: any) {
              showAlert(t.common.error, e.message);
            }
          },
        },
      ]
    );
  };

  const handlePickLogo = async () => {
    if (!isPro) { showPaywall('event_logo'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoLocalUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      showAlert(t.events.eventName, `${t.events.eventName}.`);
      return;
    }
    if (!newEventDate) {
      showAlert(t.events.eventDate, t.events.eventDateRequired);
      return;
    }
    setCreating(true);
    try {
      const ev = await createEvent({
        name: newName.trim(),
        color: newColor,
        eventDate: toLocalDateString(newEventDate),
        music: newMusic,
        logoLocalUri: logoLocalUri || undefined,
        frameId: newFrameId || undefined,
        frameCloudinaryId: newFrameCloudinaryId || undefined,
      });
      setActiveEvent(ev);
      setShowCreateSheet(false);
      setNewName('');
      setLogoLocalUri(null);
      setNewColor('#8B5CF6');
      setNewEventDate(null);
      setNewMusic(MUSIC_AUTO_ID);
      setNewFrameId(null);
      setNewFrameCloudinaryId(null);
      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    } finally {
      setCreating(false);
    }
  };

  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const overlayOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });

  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
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
      >
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t.events.title}</Text>
            <Text style={styles.subtitle}>
              {events.length} {(events.length === 1 ? t.events.titleSingular : t.events.title).toLowerCase()}
              {' · '}
              {totalVideos} {(totalVideos === 1 ? t.events.videosSingular : t.tabs.videos).toLowerCase()}
            </Text>
          </View>
          <Pressable
            style={[styles.addBtn]}
            onPress={() => setShowCreateSheet(true)}
          >
            <LinearGradient colors={['#C084FC', '#8B5CF6', '#4F46E5']} style={styles.addBtnGrad}>
              <MaterialIcons name="add" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* ─── Stats Row ─── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <LinearGradient colors={['#7C3AED22', '#4F46E522']} style={styles.statCardBg}>
              <MaterialIcons name="celebration" size={22} color={Colors.Primary} />
              <Text style={styles.statValue}>{events.length}</Text>
              <Text style={styles.statLabel}>
                {events.length === 1 ? t.events.titleSingular : t.events.title}
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.statCard}>
            <LinearGradient colors={['#EC489922', '#7C3AED22']} style={styles.statCardBg}>
              <MaterialIcons name="videocam" size={22} color={Colors.Secondary} />
              <Text style={styles.statValue}>{totalVideos}</Text>
              <Text style={styles.statLabel}>
                {totalVideos === 1 ? t.events.videosSingular : t.tabs.videos}
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.statCard}>
            <LinearGradient colors={['#10B98122', '#3B82F622']} style={styles.statCardBg}>
              <MaterialIcons name="fiber-manual-record" size={22} color={Colors.Success} />
              <Text style={styles.statValue}>
                {activeEvent ? '1' : '0'}
              </Text>
              <Text style={styles.statLabel}>
                {activeEvent ? t.analytics.activeSingular : t.analytics.active}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* ─── Search Bar ─── */}
        {events.length > 2 && (
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={18} color={Colors.TextMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t.events.search}
              placeholderTextColor={Colors.TextMuted}
              accessibilityLabel={t.events.search}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <MaterialIcons name="close" size={16} color={Colors.TextMuted} />
              </Pressable>
            )}
          </View>
        )}

        {/* ─── Event List ─── */}
        {isLoading && events.length === 0 ? (
          <View style={styles.loadingState}>
            <MaterialIcons name="hourglass-empty" size={36} color={Colors.TextMuted} />
            <Text style={styles.loadingText}>{t.common.loading}</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient colors={['#7C3AED22', '#1A1740']} style={styles.emptyIconWrap}>
              <MaterialIcons name="celebration" size={56} color={Colors.Primary + '88'} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {search ? t.videos.noResults : t.events.noEvents}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? t.videos.noResultsSub.replace('{{q}}', search)
                : t.events.noEventsSubtitle}
            </Text>
            {!search && (
              <Pressable
                onPress={() => setShowCreateSheet(true)}
                style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <LinearGradient colors={['#8B5CF6', '#4F46E5']} style={styles.emptyBtnGrad}>
                  <MaterialIcons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>{t.events.createEvent}</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.listGap}>
            {filteredEvents.map(event => (
              <EventListCard
                key={event.id}
                event={event}
                isActive={activeEvent?.id === event.id}
                isPro={isPro}
                onActivate={handleActivate}
                onDelete={handleDelete}
                onEdit={handleOpenEdit}
                onRefreshCount={refreshVideoCount}
                activeLabel={t.analytics.active}
                videosLabel={t.events.videos}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── Edit Event Bottom Sheet ─── */}
      {showEditSheet && (
        <>
          <Animated.View
            style={[styles.overlay, { opacity: editSheetAnim.interpolate({ inputRange: [0,1], outputRange: [0, 0.7] }) }]}
            pointerEvents="box-only"
          >
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowEditSheet(false)} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: insets.bottom + Spacing.lg,
                transform: [{ translateY: editSheetAnim.interpolate({ inputRange: [0,1], outputRange: [600, 0] }) }],
              },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.events.editEvent}</Text>
              <Pressable style={styles.sheetClose} onPress={() => setShowEditSheet(false)}>
                <MaterialIcons name="close" size={20} color={Colors.TextSubtle} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            <View style={styles.sheetPreviewRow}>
              <Pressable
                style={[styles.logoPicker, { borderColor: editColor + '66', backgroundColor: editColor + '15' }]}
                onPress={handlePickEditLogo}
              >
                {editLogoUri ? (
                  <Image source={{ uri: editLogoUri }} style={styles.logoPickerImg} contentFit="cover" />
                ) : (
                  <>
                    <MaterialIcons name="add-photo-alternate" size={28} color={editColor} />
                    <Text style={[styles.logoPickerText, { color: editColor }]}>{t.events.uploadLogo}</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.previewSection}>
                <Text style={styles.previewOverline}>{t.common.preview}</Text>
                <View style={[styles.previewCard, Shadow.card, { backgroundColor: editColor + '26' }]}>
                  <View style={[styles.previewDot, { backgroundColor: editColor }]} />
                  <Text style={styles.previewCardName} numberOfLines={2}>
                    {editName || t.events.eventName}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.events.eventName} *</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="short-text" size={18} color={Colors.TextSubtle} />
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t.events.eventName}
                  placeholderTextColor={Colors.TextMuted}
                  autoCapitalize="words"
                  accessibilityLabel={t.events.eventName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.events.eventColor}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.framePickerContent}
              >
                {EVENT_COLORS_LIST.map(c => (
                  <Pressable
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      editColor === c && styles.colorDotActive,
                    ]}
                    onPress={() => setEditColor(c)}
                  >
                    {editColor === c && <MaterialIcons name="check" size={14} color="#fff" />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ─── Frame Picker (Edit) ─── */}
            <View style={styles.inputGroup}>
              <View style={styles.frameSectionHeader}>
                <Text style={styles.inputLabel}>{t.frames.title}</Text>
                {editFrameId && (
                  <Pressable onPress={() => handleSelectFrameForEdit(null, null)} hitSlop={8}>
                    <Text style={styles.frameRemoveText}>{t.frames.noFrame}</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.framePickerOuter}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.framePickerContent}
                >
                  {/* No frame option */}
                  <Pressable
                    onPress={() => handleSelectFrameForEdit(null, null)}
                    style={[
                      styles.frameMiniCard,
                      !editFrameId && { borderColor: editColor, borderWidth: 2 },
                    ]}
                  >
                    <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameMiniThumb}>
                      <MaterialIcons name="close" size={16} color={Colors.TextMuted} />
                    </LinearGradient>
                    <Text style={[styles.frameMiniLabel, !editFrameId && { color: editColor }]} numberOfLines={1}>
                      {t.frames.noFrame}
                    </Text>
                  </Pressable>

                  {frames.filter(f => !f.isPremium || isPro).map(frame => {
                    const isSelected = editFrameId === frame.id;
                    return (
                      <Pressable
                        key={frame.id}
                        onPress={() => handleSelectFrameForEdit(frame.id, frame.cloudinaryPublicId)}
                        style={[
                          styles.frameMiniCard,
                          isSelected && { borderColor: editColor, borderWidth: 2 },
                        ]}
                      >
                        {frame.thumbnailUrl ? (
                          <Image
                            source={{ uri: frame.thumbnailUrl }}
                            style={styles.frameMiniThumb}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameMiniThumb}>
                            <MaterialIcons name="layers" size={16} color={Colors.TextMuted} />
                          </LinearGradient>
                        )}
                        {isSelected && (
                          <View style={styles.frameMiniCheck}>
                            <MaterialIcons name="check" size={10} color="#fff" />
                          </View>
                        )}
                        <Text style={[styles.frameMiniLabel, isSelected && { color: editColor }]} numberOfLines={1}>
                          {frame.name}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {/* Locked premium frames for free users */}
                  {!isPro && frames.filter(f => f.isPremium).map(frame => (
                    <Pressable
                      key={frame.id}
                      onPress={() => {}}
                      style={[styles.frameMiniCard, { opacity: 0.45 }]}
                    >
                      {frame.thumbnailUrl ? (
                        <Image source={{ uri: frame.thumbnailUrl }} style={styles.frameMiniThumb} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameMiniThumb}>
                          <MaterialIcons name="lock" size={14} color={Colors.TextMuted} />
                        </LinearGradient>
                      )}
                      <View style={styles.frameMiniLock}>
                        <MaterialIcons name="lock" size={9} color="#fff" />
                      </View>
                      <Text style={styles.frameMiniLabel} numberOfLines={1}>{frame.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* ─── Music Picker (Edit) ─── */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.music.sectionLabel}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.framePickerContent}
              >
                <Pressable
                  onPress={() => setEditMusic(MUSIC_AUTO_ID)}
                  style={[styles.musicChip, editMusic === MUSIC_AUTO_ID && { borderColor: editColor, borderWidth: 2 }]}
                >
                  <Text style={styles.musicChipEmoji}>🎵</Text>
                  <Text style={[styles.musicChipLabel, editMusic === MUSIC_AUTO_ID && { color: editColor }]} numberOfLines={1}>
                    {t.music.auto}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setEditMusic(MUSIC_NONE_ID)}
                  style={[styles.musicChip, editMusic === MUSIC_NONE_ID && { borderColor: editColor, borderWidth: 2 }]}
                >
                  <Text style={styles.musicChipEmoji}>🔇</Text>
                  <Text style={[styles.musicChipLabel, editMusic === MUSIC_NONE_ID && { color: editColor }]} numberOfLines={1}>
                    {t.music.none}
                  </Text>
                </Pressable>

                {freeTracks.map(track => (
                  <Pressable
                    key={track.id}
                    onPress={() => setEditMusic(track.id)}
                    style={[styles.musicChip, editMusic === track.id && { borderColor: editColor, borderWidth: 2 }]}
                  >
                    <Text style={styles.musicChipEmoji}>{track.emoji}</Text>
                    <Text style={[styles.musicChipLabel, editMusic === track.id && { color: editColor }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                  </Pressable>
                ))}

                {!isPro && premiumTracks.map(track => (
                  <Pressable key={track.id} onPress={() => showPaywall('premium_music')} style={[styles.musicChip, { opacity: 0.5 }]}>
                    <Text style={styles.musicChipEmoji}>{track.emoji}</Text>
                    <Text style={styles.musicChipLabel} numberOfLines={1}>{track.title}</Text>
                    <MaterialIcons name="lock" size={11} color={Colors.TextMuted} />
                  </Pressable>
                ))}

                {isPro && premiumTracks.map(track => (
                  <Pressable
                    key={track.id}
                    onPress={() => setEditMusic(track.id)}
                    style={[styles.musicChip, editMusic === track.id && { borderColor: editColor, borderWidth: 2 }]}
                  >
                    <Text style={styles.musicChipEmoji}>{track.emoji}</Text>
                    <Text style={[styles.musicChipLabel, editMusic === track.id && { color: editColor }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
            <Pressable
              style={({ pressed }) => [styles.createBtn, { opacity: pressed || saving ? 0.85 : 1 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              <LinearGradient
                colors={['#C084FC', '#8B5CF6', '#4F46E5']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.createBtnGrad}
              >
                {saving
                  ? <MaterialIcons name="hourglass-empty" size={20} color="#fff" />
                  : <MaterialIcons name="check" size={20} color="#fff" />}
                <Text style={styles.createBtnText}>
                  {saving ? t.common.loading : t.common.save}
                </Text>
              </LinearGradient>
            </Pressable>
            </View>
          </Animated.View>
        </>
      )}

      {/* ─── Create Event Bottom Sheet ─── */}
      {showCreateSheet && (
        <>
          <Animated.View
            style={[styles.overlay, { opacity: overlayOpacity }]}
            pointerEvents="box-only"
          >
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowCreateSheet(false)} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + Spacing.lg, transform: [{ translateY: sheetTranslate }] },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.events.newEvent}</Text>
              <Pressable style={styles.sheetClose} onPress={() => setShowCreateSheet(false)}>
                <MaterialIcons name="close" size={20} color={Colors.TextSubtle} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            <View style={styles.sheetPreviewRow}>
              <Pressable style={[styles.logoPicker, { borderColor: newColor + '66', backgroundColor: newColor + '15' }]} onPress={handlePickLogo}>
                {logoLocalUri ? (
                  <Image source={{ uri: logoLocalUri }} style={styles.logoPickerImg} contentFit="cover" />
                ) : (
                  <>
                    <MaterialIcons name="add-photo-alternate" size={28} color={newColor} />
                    <Text style={[styles.logoPickerText, { color: newColor }]}>{t.events.uploadLogo}</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.previewSection}>
                <Text style={styles.previewOverline}>{t.common.preview}</Text>
                <View style={[styles.previewCard, Shadow.card, { backgroundColor: newColor + '26' }]}>
                  <View style={[styles.previewDot, { backgroundColor: newColor }]} />
                  <Text style={styles.previewCardName} numberOfLines={2}>
                    {newName || t.events.eventName}
                  </Text>
                  <View style={styles.previewCardMeta}>
                    <MaterialIcons name="videocam" size={12} color={Colors.TextMuted} />
                    <Text style={styles.previewCardMetaText}>0 {t.events.videos}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.events.eventName} *</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="short-text" size={18} color={Colors.TextSubtle} />
                <TextInput
                  style={styles.textInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder={t.events.eventName}
                  placeholderTextColor={Colors.TextMuted}
                  autoCapitalize="words"
                  accessibilityLabel={t.events.eventName}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.events.eventDate} *</Text>
              <Pressable style={styles.inputWrapper} onPress={() => setShowNewEventDatePicker(true)}>
                <MaterialIcons name="calendar-today" size={18} color={Colors.TextSubtle} />
                <Text style={[styles.textInput, !newEventDate && { color: Colors.TextMuted }]}>
                  {newEventDate ? newEventDate.toLocaleDateString() : t.events.eventDate}
                </Text>
              </Pressable>
              {showNewEventDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={newEventDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(_event, selectedDate) => {
                    setShowNewEventDatePicker(false);
                    if (selectedDate) setNewEventDate(selectedDate);
                  }}
                />
              )}
              {Platform.OS === 'ios' && (
                <Modal visible={showNewEventDatePicker} transparent animationType="slide" onRequestClose={() => setShowNewEventDatePicker(false)}>
                  <View style={styles.datePickerOverlay}>
                    <View style={styles.datePickerSheet}>
                      <DateTimePicker
                        value={newEventDate || new Date()}
                        mode="date"
                        display="inline"
                        onChange={(_event, selectedDate) => {
                          if (selectedDate) setNewEventDate(selectedDate);
                        }}
                      />
                      <Pressable style={styles.datePickerConfirmBtn} onPress={() => setShowNewEventDatePicker(false)}>
                        <Text style={styles.datePickerConfirmText}>{t.common.ok}</Text>
                      </Pressable>
                    </View>
                  </View>
                </Modal>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.events.eventColor}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.framePickerContent}
              >
                {EVENT_COLORS_LIST.map(c => (
                  <Pressable
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      newColor === c && styles.colorDotActive,
                    ]}
                    onPress={() => setNewColor(c)}
                  >
                    {newColor === c && (
                      <MaterialIcons name="check" size={14} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ─── Frame Picker (Create) ─── */}
            <View style={styles.inputGroup}>
              <View style={styles.frameSectionHeader}>
                <Text style={styles.inputLabel}>{t.frames.title}</Text>
                {newFrameId && (
                  <Pressable onPress={() => handleSelectFrameForCreate(null, null)} hitSlop={8}>
                    <Text style={styles.frameRemoveText}>{t.frames.noFrame}</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.framePickerOuter}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.framePickerContent}
                >
                  {/* No frame option */}
                  <Pressable
                    onPress={() => handleSelectFrameForCreate(null, null)}
                    style={[
                      styles.frameMiniCard,
                      !newFrameId && { borderColor: newColor, borderWidth: 2 },
                    ]}
                  >
                    <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameMiniThumb}>
                      <MaterialIcons name="close" size={16} color={Colors.TextMuted} />
                    </LinearGradient>
                    <Text style={[styles.frameMiniLabel, !newFrameId && { color: newColor }]} numberOfLines={1}>
                      {t.frames.noFrame}
                    </Text>
                  </Pressable>

                  {frames.filter(f => !f.isPremium || isPro).map(frame => {
                    const isSelected = newFrameId === frame.id;
                    return (
                      <Pressable
                        key={frame.id}
                        onPress={() => handleSelectFrameForCreate(frame.id, frame.cloudinaryPublicId)}
                        style={[
                          styles.frameMiniCard,
                          isSelected && { borderColor: newColor, borderWidth: 2 },
                        ]}
                      >
                        {frame.thumbnailUrl ? (
                          <Image
                            source={{ uri: frame.thumbnailUrl }}
                            style={styles.frameMiniThumb}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameMiniThumb}>
                            <MaterialIcons name="layers" size={16} color={Colors.TextMuted} />
                          </LinearGradient>
                        )}
                        {isSelected && (
                          <View style={styles.frameMiniCheck}>
                            <MaterialIcons name="check" size={10} color="#fff" />
                          </View>
                        )}
                        <Text style={[styles.frameMiniLabel, isSelected && { color: newColor }]} numberOfLines={1}>
                          {frame.name}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {/* Locked premium frames for free users */}
                  {!isPro && frames.filter(f => f.isPremium).map(frame => (
                    <Pressable
                      key={frame.id}
                      onPress={() => {}}
                      style={[styles.frameMiniCard, { opacity: 0.45 }]}
                    >
                      {frame.thumbnailUrl ? (
                        <Image source={{ uri: frame.thumbnailUrl }} style={styles.frameMiniThumb} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameMiniThumb}>
                          <MaterialIcons name="lock" size={14} color={Colors.TextMuted} />
                        </LinearGradient>
                      )}
                      <View style={styles.frameMiniLock}>
                        <MaterialIcons name="lock" size={9} color="#fff" />
                      </View>
                      <Text style={styles.frameMiniLabel} numberOfLines={1}>{frame.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* ─── Music Picker (Create) ─── */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.music.sectionLabel}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.framePickerContent}
              >
                <Pressable
                  onPress={() => setNewMusic(MUSIC_AUTO_ID)}
                  style={[styles.musicChip, newMusic === MUSIC_AUTO_ID && { borderColor: newColor, borderWidth: 2 }]}
                >
                  <Text style={styles.musicChipEmoji}>🎵</Text>
                  <Text style={[styles.musicChipLabel, newMusic === MUSIC_AUTO_ID && { color: newColor }]} numberOfLines={1}>
                    {t.music.auto}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setNewMusic(MUSIC_NONE_ID)}
                  style={[styles.musicChip, newMusic === MUSIC_NONE_ID && { borderColor: newColor, borderWidth: 2 }]}
                >
                  <Text style={styles.musicChipEmoji}>🔇</Text>
                  <Text style={[styles.musicChipLabel, newMusic === MUSIC_NONE_ID && { color: newColor }]} numberOfLines={1}>
                    {t.music.none}
                  </Text>
                </Pressable>

                {freeTracks.map(track => (
                  <Pressable
                    key={track.id}
                    onPress={() => setNewMusic(track.id)}
                    style={[styles.musicChip, newMusic === track.id && { borderColor: newColor, borderWidth: 2 }]}
                  >
                    <Text style={styles.musicChipEmoji}>{track.emoji}</Text>
                    <Text style={[styles.musicChipLabel, newMusic === track.id && { color: newColor }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                  </Pressable>
                ))}

                {!isPro && premiumTracks.map(track => (
                  <Pressable key={track.id} onPress={() => showPaywall('premium_music')} style={[styles.musicChip, { opacity: 0.5 }]}>
                    <Text style={styles.musicChipEmoji}>{track.emoji}</Text>
                    <Text style={styles.musicChipLabel} numberOfLines={1}>{track.title}</Text>
                    <MaterialIcons name="lock" size={11} color={Colors.TextMuted} />
                  </Pressable>
                ))}

                {isPro && premiumTracks.map(track => (
                  <Pressable
                    key={track.id}
                    onPress={() => setNewMusic(track.id)}
                    style={[styles.musicChip, newMusic === track.id && { borderColor: newColor, borderWidth: 2 }]}
                  >
                    <Text style={styles.musicChipEmoji}>{track.emoji}</Text>
                    <Text style={[styles.musicChipLabel, newMusic === track.id && { color: newColor }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable
                style={({ pressed }) => [styles.createBtn, { opacity: pressed || creating ? 0.85 : 1 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                <LinearGradient
                  colors={['#C084FC', '#8B5CF6', '#4F46E5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createBtnGrad}
                >
                  {creating ? (
                    <MaterialIcons name="hourglass-empty" size={20} color="#fff" />
                  ) : (
                    <MaterialIcons name="add" size={20} color="#fff" />
                  )}
                  <Text style={styles.createBtnText}>
                    {creating ? t.common.loading : t.events.createEvent}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },

  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerSheet: {
    backgroundColor: Colors.SurfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  datePickerConfirmBtn: {
    backgroundColor: Colors.Primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  datePickerConfirmText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  subtitle: { color: Colors.TextSubtle, fontSize: FontSize.xs, marginTop: 3 },
  addBtn: { borderRadius: Radius.full, overflow: 'hidden', shadowColor: Colors.Primary, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  addBtnGrad: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.Border },
  statCardBg: { flex: 1, justifyContent: 'center', padding: Spacing.md, alignItems: 'center', gap: 3 },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  statLabel: { fontSize: 10, color: Colors.TextSubtle, textAlign: 'center' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border,
    paddingHorizontal: Spacing.md, height: 46,
  },
  searchInput: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm },

  loadingState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  loadingText: { color: Colors.TextMuted, fontSize: FontSize.sm },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyIconWrap: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.TextSubtle, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { marginTop: Spacing.sm, borderRadius: Radius.full, overflow: 'hidden' },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  emptyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  listGap: { gap: Spacing.sm },
  eventCard: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.Border,
    overflow: 'hidden',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  eventMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: 4,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImg: { width: '100%', height: '100%' },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  cardTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  cardName: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.TextPrimary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    flexShrink: 0,
  },

  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  activeBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  cardBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.Surface,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.Border,
    flexShrink: 0,
  },
  statChipText: { color: Colors.TextSubtle, fontSize: 11 },
  unlockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    flexShrink: 0,
    marginTop: 6,
  },
  unlockChipText: { fontSize: 10, fontWeight: FontWeight.semibold },
    cardDate: {
    color: Colors.TextMuted,
    fontSize: 11,
    flexShrink: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingLeft: 72,
  },
  cardActions: { flexDirection: 'row', gap: 4 },
  cardActionBtn: {
    height: 34,
    minWidth: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.Border,
    paddingHorizontal: 9,
  },
  monitorActionBtn: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },

  monitorActionText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 40,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '88%',
    backgroundColor: '#13103A',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: Colors.Border,
    paddingTop: Spacing.sm,
    zIndex: 50,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 24,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: Colors.Border,
    borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  sheetScroll: { paddingHorizontal: Spacing.lg },
  sheetScrollContent: { gap: Spacing.lg, paddingTop: Spacing.lg },
  sheetFooter: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderWidth: 1, borderColor: Colors.Border,
  },

  sheetPreviewRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  logoPicker: {
    width: 80, height: 80, borderRadius: Radius.lg,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden',
  },
  logoPickerImg: { width: '100%', height: '100%' },
  logoPickerText: { textAlign: 'center', fontSize: 10, fontWeight: FontWeight.semibold },
  previewSection: { flex: 1, gap: Spacing.xs },
  previewOverline: {
    fontSize: 10, fontWeight: FontWeight.bold, color: Colors.TextMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  previewCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md, gap: 6,
  },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  previewCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewCardMetaText: { color: Colors.TextMuted, fontSize: 11 },

  inputGroup: { gap: Spacing.sm },
  inputLabel: { color: Colors.TextSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.Border,
    paddingHorizontal: Spacing.md, height: 52,
  },
  textInput: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.md },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorDot: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },

  createBtn: { borderRadius: Radius.full, overflow: 'hidden' },
  createBtnGrad: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
  },
  createBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Frame picker inside sheets
  frameSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  frameRemoveText: {
    fontSize: FontSize.xs, color: Colors.TextMuted,
    fontWeight: FontWeight.medium,
  },
  framePickerOuter: {
    minHeight: 130,
    marginHorizontal: -Spacing.lg,
  },
  framePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  frameMiniCard: {
    width: 78, alignItems: 'center', gap: 4,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.Border,
    padding: 2, position: 'relative',
  },
  frameMiniThumb: {
    width: 72, height: 108, borderRadius: Radius.sm,
    backgroundColor: Colors.Surface,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  frameMiniCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.Primary,
    alignItems: 'center', justifyContent: 'center',
  },
  frameMiniLock: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  frameMiniLabel: {
    fontSize: 9, color: Colors.TextMuted,
    fontWeight: FontWeight.medium,
    textAlign: 'center', width: 78,
    paddingHorizontal: 2,
  },

  musicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.Border,
    backgroundColor: Colors.SurfaceElevated,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    maxWidth: 150,
  },
  musicChipEmoji: { fontSize: 14 },
  musicChipLabel: {
    fontSize: FontSize.xs, color: Colors.TextSecondary,
    fontWeight: FontWeight.medium,
  },
});
