import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

interface QRCodeDisplayProps {
  url: string;
  eventName?: string;
  eventColor?: string;
  onCopy?: () => void;
  onWhatsApp?: () => void;
}

export function QRCodeDisplay({ url, eventName, eventColor = Colors.Primary, onCopy, onWhatsApp }: QRCodeDisplayProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.qrWrapper, { borderColor: eventColor + '44' }, Shadow.glow]}>
        <QRCode
          value={url}
          size={220}
          color="#1A1740"
          backgroundColor="#FFFFFF"
          logo={undefined}
        />
      </View>

      {eventName && (
        <View style={[styles.eventBadge, { backgroundColor: eventColor + '22', borderColor: eventColor + '44' }]}>
          <View style={[styles.eventDot, { backgroundColor: eventColor }]} />
          <Text style={[styles.eventName, { color: eventColor }]}>{eventName}</Text>
        </View>
      )}

      <Text style={styles.hint}>Escaneie para baixar seu vídeo</Text>

      <View style={styles.actions}>
        {onWhatsApp && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.whatsappBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={onWhatsApp}
          >
            <MaterialIcons name="chat" size={20} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </Pressable>
        )}
        {onCopy && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.copyBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={onCopy}
          >
            <MaterialIcons name="content-copy" size={20} color={Colors.Primary} />
            <Text style={[styles.actionText, { color: Colors.Primary }]}>Copiar Link</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 2,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  hint: {
    color: Colors.TextSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.full,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  copyBtn: {
    borderWidth: 1.5,
    borderColor: Colors.Primary,
  },
  actionText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
