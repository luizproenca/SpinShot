import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useEvents } from '../hooks/useEvents';
import { useLanguage } from '../hooks/useLanguage';
import { usePlan } from '../hooks/usePlan';
import { GradientButton } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { EVENT_COLORS } from '../constants/config';

export default function CreateEventScreen() {
  const { createEvent, setActiveEvent, events } = useEvents();
  const { t } = useLanguage();
  const { isPro, showPaywall } = usePlan();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    // Free plan: max 1 event
    if (!isPro && events.length >= 1) {
      showPaywall('event_limit');
      return;
    }
    if (!name.trim()) {
      showAlert(t.events.eventName, t.events.eventName + '.');
      return;
    }
    setLoading(true);
    try {
      const event = await createEvent({ name: name.trim(), color });
      setActiveEvent(event);
      showAlert(t.events.createEvent, `"${name}" ${t.events.eventName}.`, [
        { text: t.common.ok, onPress: () => router.back() },
      ]);
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0D0820', '#1A0533', '#0A0F2E']} style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.closeBtn} onPress={() => router.back()}>
              <MaterialIcons name="close" size={22} color={Colors.TextSecondary} />
            </Pressable>
            <Text style={styles.title}>{t.events.newEvent}</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Free plan banner */}
          {!isPro && events.length >= 1 && (
            <Pressable
              onPress={() => showPaywall('event_limit')}
              style={styles.limitBanner}
            >
              <LinearGradient colors={['#EF444422', '#7C3AED22']} style={styles.limitBannerGrad}>
                <MaterialIcons name="lock" size={16} color={Colors.Warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.limitBannerTitle}>{t.events.eventLimit}</Text>
                  <Text style={styles.limitBannerSub}>{t.events.eventLimitMsg}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={Colors.Warning} />
              </LinearGradient>
            </Pressable>
          )}

          {/* Preview Card */}
          <View style={[styles.previewCard, { borderColor: color + '66' }]}>
            <LinearGradient colors={[color + '33', Colors.SurfaceElevated]} style={styles.previewGrad}>
              <View style={[styles.previewIcon, { backgroundColor: color + '22' }]}>
                <MaterialIcons name="celebration" size={32} color={color} />
              </View>
              <Text style={styles.previewName} numberOfLines={1}>
                {name || t.events.eventName}
              </Text>
            </LinearGradient>
          </View>

          {/* Name Input */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.events.eventName}</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="event" size={20} color={Colors.TextSubtle} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t.events.eventName}
                placeholderTextColor={Colors.TextMuted}
                autoCapitalize="words"
                accessibilityLabel="Nome do evento"
              />
            </View>
          </View>

          {/* Color Picker */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.events.eventColor}</Text>
            <View style={styles.colorGrid}>
              {EVENT_COLORS.map(c => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotActive,
                  ]}
                  onPress={() => setColor(c)}
                >
                  {color === c && (
                    <MaterialIcons name="check" size={16} color="#fff" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          <GradientButton
            title={t.events.createEvent}
            onPress={handleCreate}
            loading={loading}
            style={styles.createBtn}
            icon={<MaterialIcons name="add" size={22} color="#fff" />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xl, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.SurfaceElevated, borderRadius: 22 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  limitBanner: { borderRadius: Radius.xl, overflow: 'hidden' },
  limitBannerGrad: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.Warning + '44', borderRadius: Radius.xl,
  },
  limitBannerTitle: { color: Colors.Warning, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  limitBannerSub: { color: Colors.TextSubtle, fontSize: FontSize.xs, marginTop: 2, lineHeight: 17 },
  previewCard: { borderRadius: Radius.xl, borderWidth: 1.5, overflow: 'hidden' },
  previewGrad: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  previewIcon: { width: 72, height: 72, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary, textAlign: 'center' },
  section: { gap: Spacing.md },
  label: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.TextSecondary },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.Border, paddingHorizontal: Spacing.md, height: 56 },
  input: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.md },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  colorDot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  createBtn: { marginTop: Spacing.sm },
});
