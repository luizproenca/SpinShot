import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  Animated, ActivityIndicator, Platform, TextInput,
  Modal, ScrollView, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAlert } from '@/template';
import { useFrames } from '../../hooks/useFrames';
import { usePlan } from '../../hooks/usePlan';
import { useLanguage } from '../../hooks/useLanguage';
import { useEvents } from '../../hooks/useEvents';
import { VideoFrame } from '../../services/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - Spacing.lg * 2 - Spacing.sm * 2) / 3;

// ─── Frame Card ─────────────────────────────────────────────────────────────
function FrameCard({
  frame,
  isSelected,
  isPro,
  onPress,
  onUpgrade,
  onDelete,
}: {
  frame: VideoFrame;
  isSelected: boolean;
  isPro: boolean;
  onPress: () => void;
  onUpgrade: () => void;
  onDelete?: () => void;
}) {
  const isLocked = frame.isPremium && !isPro;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, speed: 60 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={[styles.frameCardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={isLocked ? onUpgrade : onPress}
        onLongPress={onDelete}
        delayLongPress={600}
        style={[
          styles.frameCard,
          isSelected && { borderColor: Colors.Primary, borderWidth: 2.5 },
          isLocked && { opacity: 0.65 },
        ]}
      >
        {frame.thumbnailUrl ? (
          <Image
            source={{ uri: frame.thumbnailUrl }}
            style={styles.frameThumbnail}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={['#1E1B3A', '#0D0820']}
            style={styles.frameThumbnail}
          >
            <MaterialIcons name="image" size={28} color={Colors.TextMuted} />
          </LinearGradient>
        )}

        {/* Overlay on top of thumbnail */}
        {isSelected && (
          <View style={styles.frameSelectedOverlay}>
            <LinearGradient
              colors={[Colors.Primary + 'CC', Colors.Accent + 'CC']}
              style={styles.frameSelectedBadge}
            >
              <MaterialIcons name="check" size={16} color="#fff" />
            </LinearGradient>
          </View>
        )}

        {isLocked && (
          <View style={styles.frameLockOverlay}>
            <MaterialIcons name="lock" size={16} color="#fff" />
          </View>
        )}

        {frame.isPremium && (
          <View style={styles.framePremiumBadge}>
            <MaterialIcons name="star" size={9} color="#F59E0B" />
            <Text style={styles.framePremiumText}>PRO</Text>
          </View>
        )}

        {!frame.isDefault && (
          <View style={styles.framePersonalBadge}>
            <MaterialIcons name="person" size={9} color={Colors.Primary} />
          </View>
        )}
      </Pressable>

      <Text style={[styles.frameCardName, isSelected && { color: Colors.Primary }]} numberOfLines={1}>
        {frame.name}
      </Text>
    </Animated.View>
  );
}

// ─── No Frame Card ──────────────────────────────────────────────────────────
function NoFrameCard({ isSelected, onPress }: { isSelected: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, speed: 60 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={[styles.frameCardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[styles.frameCard, isSelected && { borderColor: Colors.Primary, borderWidth: 2.5 }]}
      >
        <LinearGradient colors={['#1E1B3A', '#13103A']} style={styles.frameThumbnail}>
          <MaterialIcons name="close" size={24} color={Colors.TextMuted} />
        </LinearGradient>
        {isSelected && (
          <View style={styles.frameSelectedOverlay}>
            <LinearGradient
              colors={[Colors.Primary + 'CC', Colors.Accent + 'CC']}
              style={styles.frameSelectedBadge}
            >
              <MaterialIcons name="check" size={16} color="#fff" />
            </LinearGradient>
          </View>
        )}
      </Pressable>
      <Text style={[styles.frameCardName, isSelected && { color: Colors.Primary }]} numberOfLines={1}>
        Sem moldura
      </Text>
    </Animated.View>
  );
}

// ─── Frame Preview Modal ────────────────────────────────────────────────────
function FramePreviewModal({
  frame,
  visible,
  onClose,
  onSelect,
  isSelected,
}: {
  frame: VideoFrame | null;
  visible: boolean;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  if (!frame) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.previewModalOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.previewModalCard}>
          <View style={styles.previewModalHeader}>
            <Text style={styles.previewModalTitle}>{frame.name}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={20} color={Colors.TextSubtle} />
            </Pressable>
          </View>

          {/* Mock video background + frame overlay preview */}
          <View style={styles.previewComposition}>
            {/* Simulated video background */}
            <LinearGradient
              colors={['#2D1B69', '#0D0820', '#1a1040']}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Silhouette placeholder */}
            <MaterialIcons name="person" size={80} color="rgba(255,255,255,0.15)" />

            {/* Frame overlay */}
            {frame.thumbnailUrl ? (
              <Image
                source={{ uri: frame.thumbnailUrl }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                transition={200}
              />
            ) : null}

            <View style={styles.previewLabel}>
              <Text style={styles.previewLabelText}>Preview da moldura</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.previewSelectBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => { onSelect(); onClose(); }}
          >
            <LinearGradient
              colors={isSelected ? ['#10B981', '#059669'] : ['#C084FC', '#8B5CF6', '#4F46E5']}
              style={styles.previewSelectBtnGrad}
            >
              <MaterialIcons name={isSelected ? 'check-circle' : 'add'} size={20} color="#fff" />
              <Text style={styles.previewSelectBtnText}>
                {isSelected ? 'Moldura selecionada' : 'Usar esta moldura'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Upload Name Modal (with frame preview) ────────────────────────────────
function NameInputModal({
  visible,
  onClose,
  onConfirm,
  previewUri,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  previewUri: string | null;
}) {
  const [name, setName] = useState('');
  const { t } = useLanguage();

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim());
    setName('');
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.nameModalOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={styles.nameModalCard}>
          {/* Header */}
          <View style={styles.nameModalHeader}>
            <Text style={styles.nameModalTitle}>{t.frames.nameFrame}</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <MaterialIcons name="close" size={20} color={Colors.TextSubtle} />
            </Pressable>
          </View>

          {/* Frame preview on silhouette */}
          {previewUri ? (
            <View style={styles.nameModalPreview}>
              {/* Simulated dark video background */}
              <LinearGradient
                colors={['#2D1B69', '#1a1040', '#0D0820']}
                style={StyleSheet.absoluteFillObject}
              />
              {/* Person silhouette */}
              <View style={styles.nameModalSilhouette}>
                <MaterialIcons name="person" size={80} color="rgba(255,255,255,0.15)" />
              </View>
              {/* Frame overlay */}
              <Image
                source={{ uri: previewUri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                transition={200}
              />
              {/* Labels */}
              <View style={styles.nameModalPreviewBadge}>
                <MaterialIcons name="visibility" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={styles.nameModalPreviewBadgeText}>{t.frames.previewLabel}</Text>
              </View>
              <View style={styles.nameModalAspectBadge}>
                <Text style={styles.nameModalAspectText}>9:16</Text>
              </View>
            </View>
          ) : null}

          {/* Name input */}
          <View style={styles.nameModalInputGroup}>
            <Text style={styles.nameModalInputLabel}>{t.frames.frameName}</Text>
            <TextInput
              style={styles.nameModalInput}
              value={name}
              onChangeText={setName}
              placeholder={t.frames.frameNamePlaceholder}
              placeholderTextColor={Colors.TextMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
          </View>

          <View style={styles.nameModalActions}>
            <Pressable
              style={({ pressed }) => [styles.nameModalBtn, styles.nameModalBtnCancel, { opacity: pressed ? 0.8 : 1 }]}
              onPress={handleClose}
            >
              <Text style={styles.nameModalBtnCancelText}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.nameModalBtn, { opacity: pressed || !name.trim() ? 0.7 : 1 }]}
              onPress={handleConfirm}
              disabled={!name.trim()}
            >
              <LinearGradient colors={['#C084FC', '#8B5CF6', '#4F46E5']} style={styles.nameModalBtnConfirm}>
                <MaterialIcons name="cloud-upload" size={16} color="#fff" />
                <Text style={styles.nameModalBtnConfirmText}>{t.frames.uploadBtn}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Frames Screen ──────────────────────────────────────────────────────
export default function FramesScreen() {
  const { frames, defaultFrames, personalFrames, isLoading, refreshFrames, uploadFrame, deleteFrame } = useFrames();
  const { isPro, showPaywall } = usePlan();
  const { activeEvent, updateEvent } = useEvents();
  const { t } = useLanguage();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(activeEvent?.frameId || null);
  const [previewFrame, setPreviewFrame] = useState<VideoFrame | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Sync with active event's frame
  useEffect(() => {
    setSelectedFrameId(activeEvent?.frameId || null);
  }, [activeEvent?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFrames();
    setRefreshing(false);
  };

  const handleSelectFrame = async (frameId: string | null) => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
    setSelectedFrameId(frameId);

    // Persist to active event immediately
    if (activeEvent) {
      const frame = frameId ? frames.find(f => f.id === frameId) : null;
      try {
        await updateEvent(activeEvent.id, {
          frameId: frameId || undefined,
          frameCloudinaryId: frame?.cloudinaryPublicId || undefined,
        });
      } catch (e: any) {
        showAlert(t.common.error, e.message);
      }
    }
  };

  const handlePickFrame = async () => {
    if (!isPro) {
      showPaywall('frame_upload');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    // Validate PNG
    const uri = asset.uri;
    if (!uri.toLowerCase().endsWith('.png') && asset.mimeType !== 'image/png') {
      showAlert(t.frames.invalidFormat, t.frames.invalidFormatMsg);
      return;
    }

    setPendingLocalUri(uri);
    setShowNameModal(true);
  };

  const handleUploadFrame = async (name: string) => {
    if (!pendingLocalUri) return;
    setShowNameModal(false);
    setUploading(true);

    try {
      const newFrame = await uploadFrame(pendingLocalUri, name, (step) => {
        console.log('Upload step:', step);
      });

      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
      setPendingLocalUri(null);
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFrame = (frame: VideoFrame) => {
    if (frame.isDefault) return; // Can't delete default frames
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    showAlert(
      t.frames.deleteFrame,
      t.frames.deleteFrameMsg.replace('{{name}}', frame.name),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFrame(frame.id);
              if (selectedFrameId === frame.id) setSelectedFrameId(null);
            } catch (e: any) {
              showAlert(t.common.error, e.message);
            }
          },
        },
      ]
    );
  };

  const openPreview = (frame: VideoFrame) => {
    setPreviewFrame(frame);
    setShowPreview(true);
  };

  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onScrollBeginDrag={() => {}}
      >
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t.frames.title}</Text>
            <Text style={styles.subtitle}>
              {activeEvent
                ? `${t.frames.eventSub} ${activeEvent.name}`
                : t.frames.noEventSub}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onRefresh}
            hitSlop={8}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={Colors.Primary} />
              : <MaterialIcons name="refresh" size={20} color={Colors.TextSubtle} />}
          </Pressable>
        </View>

        {/* ─── Active Event Info ─── */}
        {activeEvent && (
          <View style={[styles.eventBanner, { borderColor: activeEvent.color + '55' }]}>
            <View style={[styles.eventBannerDot, { backgroundColor: activeEvent.color }]} />
            <Text style={styles.eventBannerText} numberOfLines={1}>
              {activeEvent.name}
            </Text>
            {selectedFrameId ? (
              <View style={styles.eventFrameChip}>
                <MaterialIcons name="layers" size={11} color={Colors.Primary} />
                <Text style={styles.eventFrameChipText}>
                  {frames.find(f => f.id === selectedFrameId)?.name || t.frames.selected}
                </Text>
              </View>
            ) : (
              <Text style={styles.eventNoFrameText}>{t.frames.noFrame}</Text>
            )}
          </View>
        )}

        {/* ─── Upload CTA ─── */}
        <Pressable
          style={({ pressed }) => [styles.uploadCta, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handlePickFrame}
          disabled={uploading}
        >
          <LinearGradient
            colors={['#7C3AED22', '#4F46E522']}
            style={styles.uploadCtaGrad}
          >
            {uploading
              ? <ActivityIndicator size="small" color={Colors.Primary} />
              : <MaterialIcons name="add-photo-alternate" size={22} color={Colors.Primary} />}
            <View style={styles.uploadCtaInfo}>
              <Text style={styles.uploadCtaTitle}>
                {uploading ? t.frames.uploading : t.frames.uploadCta}
              </Text>
              <Text style={styles.uploadCtaSub}>{t.frames.uploadCtaSub}</Text>
            </View>
            {!uploading && (
              <MaterialIcons name="keyboard-arrow-right" size={20} color={Colors.TextMuted} />
            )}
          </LinearGradient>
        </Pressable>

        {/* ─── "No Frame" Option ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{t.frames.selection}</Text>
        </View>

        <View style={styles.gridRow}>
          <NoFrameCard
            isSelected={selectedFrameId === null}
            onPress={() => handleSelectFrame(null)}
          />
        </View>

        {/* ─── Default Frames ─── */}
        {defaultFrames.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{t.frames.library}</Text>
              {!isPro && (
                <Pressable onPress={() => showPaywall()} hitSlop={8}>
                  <Text style={styles.unlockText}>{t.frames.unlock}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.grid}>
              {defaultFrames.map(frame => (
                <FrameCard
                  key={frame.id}
                  frame={frame}
                  isSelected={selectedFrameId === frame.id}
                  isPro={isPro}
                  onPress={() => {
                    if (!frame.isPremium || isPro) {
                      openPreview(frame);
                    }
                  }}
                  onUpgrade={() => showPaywall()}
                />
              ))}
            </View>
          </>
        )}

        {/* ─── Personal Frames ─── */}
        {personalFrames.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
              <Text style={styles.sectionLabel}>{t.frames.myFrames}</Text>
              <Text style={styles.holdHint}>{t.frames.holdToDelete}</Text>
            </View>

            <View style={styles.grid}>
              {personalFrames.map(frame => (
                <FrameCard
                  key={frame.id}
                  frame={frame}
                  isSelected={selectedFrameId === frame.id}
                  isPro={true}
                  onPress={() => openPreview(frame)}
                  onUpgrade={() => {}}
                  onDelete={() => handleDeleteFrame(frame)}
                />
              ))}
            </View>
          </>
        )}

        {/* ─── Empty State ─── */}
        {!isLoading && frames.length === 0 && (
          <View style={styles.emptyState}>
            <LinearGradient colors={['#7C3AED18', '#0D0820']} style={styles.emptyIconWrap}>
              <MaterialIcons name="layers" size={48} color={Colors.Primary + '88'} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>{t.frames.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{t.frames.emptySubtitle}</Text>
          </View>
        )}

        {/* ─── Pro Upsell ─── */}
        {!isPro && (
          <Pressable
            onPress={() => showPaywall()}
            style={({ pressed }) => [styles.upsellBanner, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={['#7C3AED1A', '#EC48991A']}
              style={styles.upsellBannerGrad}
            >
              <MaterialIcons name="star" size={18} color="#F59E0B" />
              <View style={styles.upsellInfo}>
                <Text style={styles.upsellTitle}>{t.frames.upsellTitle}</Text>
                <Text style={styles.upsellSub}>{t.frames.upsellSub}</Text>
              </View>
              <View style={styles.upsellBtn}>
                <Text style={styles.upsellBtnText}>{t.frames.upgrade}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}
      </ScrollView>

      {/* ─── Frame Preview Modal ─── */}
      <FramePreviewModal
        frame={previewFrame}
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        isSelected={previewFrame ? selectedFrameId === previewFrame.id : false}
        onSelect={() => {
          if (previewFrame) handleSelectFrame(previewFrame.id);
        }}
      />

      {/* ─── Name Input Modal ─── */}
      <NameInputModal
        visible={showNameModal}
        onClose={() => { setShowNameModal(false); setPendingLocalUri(null); }}
        onConfirm={handleUploadFrame}
        previewUri={pendingLocalUri}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  subtitle: { color: Colors.TextSubtle, fontSize: FontSize.xs, marginTop: 3 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1, borderColor: Colors.Border,
    alignItems: 'center', justifyContent: 'center',
  },

  eventBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  eventBannerDot: { width: 8, height: 8, borderRadius: 4 },
  eventBannerText: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  eventFrameChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.Primary + '18', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.Primary + '33',
  },
  eventFrameChipText: { color: Colors.Primary, fontSize: 10, fontWeight: FontWeight.semibold },
  eventNoFrameText: { color: Colors.TextMuted, fontSize: FontSize.xs },

  uploadCta: { borderRadius: Radius.lg, overflow: 'hidden' },
  uploadCtaGrad: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.Primary + '33', borderRadius: Radius.lg,
  },
  uploadCtaInfo: { flex: 1 },
  uploadCtaTitle: { color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  uploadCtaSub: { color: Colors.TextMuted, fontSize: 11, marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: -Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    color: Colors.TextMuted, textTransform: 'uppercase', letterSpacing: 1,
  },
  unlockText: { color: Colors.Primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  holdHint: { color: Colors.TextMuted, fontSize: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  frameCardWrap: { width: CARD_W, alignItems: 'center', gap: 5 },
  frameCard: {
    width: CARD_W,
    height: CARD_W * (16 / 9),
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.Surface,
    borderWidth: 1.5, borderColor: Colors.Border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  frameThumbnail: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  frameSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  frameSelectedBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  frameLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  framePremiumBadge: {
    position: 'absolute', top: 4, right: 4,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: Radius.full,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  framePremiumText: { color: '#F59E0B', fontSize: 8, fontWeight: FontWeight.bold },
  framePersonalBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: Colors.Primary + '22',
    borderRadius: Radius.full, padding: 3,
  },
  frameCardName: {
    fontSize: 10, color: Colors.TextSubtle, fontWeight: FontWeight.medium,
    textAlign: 'center', width: CARD_W,
  },

  emptyState: { alignItems: 'center', paddingVertical: 36, gap: Spacing.md },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.TextSubtle, textAlign: 'center', lineHeight: 22 },

  upsellBanner: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  upsellBannerGrad: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.Primary + '33', borderRadius: Radius.lg,
  },
  upsellInfo: { flex: 1 },
  upsellTitle: { color: Colors.TextPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  upsellSub: { color: Colors.TextMuted, fontSize: 10, marginTop: 1 },
  upsellBtn: {
    backgroundColor: Colors.Primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  upsellBtnText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold },

  // Preview Modal
  previewModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  previewModalCard: {
    width: '100%', backgroundColor: '#16143A',
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.Border,
    overflow: 'hidden', gap: Spacing.md, padding: Spacing.lg,
  },
  previewModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  previewComposition: {
    height: 280, borderRadius: Radius.lg, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D0820', position: 'relative',
  },
  previewLabel: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    alignItems: 'center',
  },
  previewLabelText: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  previewSelectBtn: { borderRadius: Radius.full, overflow: 'hidden' },
  previewSelectBtnGrad: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
  },
  previewSelectBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Name Input Modal
  nameModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  nameModalCard: {
    backgroundColor: '#16143A', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: Colors.Border, borderBottomWidth: 0,
    padding: Spacing.xl, gap: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  nameModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  nameModalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  nameModalPreview: {
    height: 240, borderRadius: Radius.xl, overflow: 'hidden',
    backgroundColor: '#0D0820', position: 'relative',
    borderWidth: 1, borderColor: Colors.Border,
    alignItems: 'center', justifyContent: 'center',
  },
  nameModalSilhouette: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  nameModalPreviewBadge: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    zIndex: 3,
  },
  nameModalPreviewBadgeText: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  nameModalAspectBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2, zIndex: 3,
  },
  nameModalAspectText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: FontWeight.bold },
  nameModalInputGroup: { gap: 6 },
  nameModalInputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.TextSecondary },
  nameModalInput: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.Border,
    paddingHorizontal: Spacing.md, height: 52,
    color: Colors.TextPrimary, fontSize: FontSize.md,
  },
  nameModalActions: { flexDirection: 'row', gap: Spacing.md },
  nameModalBtn: { flex: 1, borderRadius: Radius.full, overflow: 'hidden' },
  nameModalBtnCancel: {
    height: 52, backgroundColor: Colors.SurfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border, borderRadius: Radius.full,
  },
  nameModalBtnCancelText: { color: Colors.TextSubtle, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  nameModalBtnConfirm: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.full,
  },
  nameModalBtnConfirmText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
