import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { Event } from '../../services/types';

interface EventCardProps {
  event: Event;
  isActive?: boolean;
  onPress: (event: Event) => void;
  onDelete?: (event: Event) => void;
}

export function EventCard({ event, isActive, onPress, onDelete }: EventCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isActive && { borderColor: event.color, borderWidth: 2 },
        { opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={() => onPress(event)}
    >
      <LinearGradient
        colors={[event.color + '33', Colors.Surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.row}>
          <View style={[styles.iconBg, { backgroundColor: event.color + '22' }]}>
            {event.logoUri ? (
              <Image source={{ uri: event.logoUri }} style={styles.logo} contentFit="cover" />
            ) : (
              <MaterialIcons name="celebration" size={28} color={event.color} />
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{event.name}</Text>
            <View style={styles.meta}>
              <MaterialIcons name="videocam" size={12} color={Colors.TextSubtle} />
              <Text style={styles.metaText}>{event.videoCount} vídeos</Text>
            </View>
          </View>

          <View style={styles.right}>
            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: event.color }]}>
                <Text style={styles.activeBadgeText}>Ativo</Text>
              </View>
            )}
            {onDelete && (
              <Pressable onPress={() => onDelete(event)} hitSlop={8} style={styles.deleteBtn}>
                <MaterialIcons name="delete-outline" size={18} color={Colors.TextMuted} />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  gradient: {
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
  },
  info: {
    flex: 1,
  },
  name: {
    color: Colors.TextPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    color: Colors.TextSubtle,
    fontSize: FontSize.xs,
  },
  right: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  activeBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  deleteBtn: {
    padding: 4,
  },
});
