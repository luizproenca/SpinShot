import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Video } from '../../services/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { PRESET_CONFIGS } from '../../services/videoEffectsService';

interface VideoCardProps {
  video: Video;
  onShare: (video: Video) => void;
  onDelete: (video: Video) => void;
  isLatest?: boolean;
}

export function VideoCard({ video, onShare, onDelete, isLatest }: VideoCardProps) {
  // Fixed boomerang effect — ignore legacy video.effect values
  const effectInfo = PRESET_CONFIGS.boomerang;
  const date = new Date(video.createdAt);
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.card, isLatest && { borderColor: Colors.Primary + '66' }]}>
      {/* Thumbnail / Color strip */}
      <View style={[styles.thumb, { backgroundColor: video.eventColor + '33' }]}>
        <View style={[styles.thumbDot, { backgroundColor: video.eventColor }]} />
        <Text style={styles.thumbEmoji}>{effectInfo.emoji}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.infoTop}>
          <Text style={styles.eventName} numberOfLines={1}>{video.eventName}</Text>
          {isLatest && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NOVO</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <MaterialIcons name="timer" size={11} color={Colors.TextMuted} />
          <Text style={styles.metaText}>{video.duration}s</Text>
          <Text style={styles.metaDot}>·</Text>
          <MaterialIcons name="event" size={11} color={Colors.TextMuted} />
          <Text style={styles.metaText}>{dateStr} {timeStr}</Text>
          {video.downloads > 0 && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <MaterialIcons name="download" size={11} color={Colors.TextMuted} />
              <Text style={styles.metaText}>{video.downloads}</Text>
            </>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.shareBtn, { opacity: pressed ? 0.75 : 1 }]}
          onPress={() => onShare(video)}
        >
          <MaterialIcons name="qr-code" size={18} color={Colors.Primary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.75 : 1 }]}
          onPress={() => onDelete(video)}
        >
          <MaterialIcons name="delete-outline" size={18} color={Colors.Error} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.Border, padding: Spacing.md, marginBottom: Spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  thumbDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 8, right: 8 },
  thumbEmoji: { fontSize: 22 },
  info: { flex: 1, gap: 4 },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eventName: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  newBadge: { backgroundColor: Colors.Primary, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  newBadgeText: { color: '#fff', fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { color: Colors.TextMuted, fontSize: 10 },
  metaDot: { color: Colors.TextMuted, fontSize: 10 },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.Surface },
  shareBtn: { backgroundColor: Colors.GlassMedium },
});
