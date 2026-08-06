import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useEvents } from '../hooks/useEvents';
import { useLanguage } from '../hooks/useLanguage';
import { toLocalDateString } from '../services/eventService';
import { GradientButton } from '../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { EVENT_COLORS } from '../constants/config';

export default function CreateEventScreen() {
  const { createEvent, setActiveEvent } = useEvents();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      showAlert(t.events.eventName, t.events.eventName + '.');
      return;
    }
    if (!eventDate) {
      showAlert(t.events.eventDate, t.events.eventDateRequired);
      return;
    }
    setLoading(true);
    try {
      const eventDateIso = toLocalDateString(eventDate);
      const event = await createEvent({ name: name.trim(), color, eventDate: eventDateIso });
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

          {/* Preview Card */}
          <View style={styles.previewSection}>
            <Text style={styles.previewOverline}>{t.common.preview}</Text>
            <View style={styles.previewCard}>
              <LinearGradient colors={[color + '33', Colors.SurfaceElevated]} style={styles.previewGrad}>
                <View style={[styles.previewIcon, { backgroundColor: color + '22' }]}>
                  <MaterialIcons name="celebration" size={32} color={color} />
                </View>
                <Text style={styles.previewName} numberOfLines={1}>
                  {name || t.events.eventName}
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* Name Input */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.events.eventName} *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="short-text" size={20} color={Colors.TextSubtle} />
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

          {/* Date Picker */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.events.eventDate} *</Text>
            <Pressable style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
              <MaterialIcons name="calendar-today" size={20} color={Colors.TextSubtle} />
              <Text style={[styles.input, !eventDate && { color: Colors.TextMuted }]}>
                {eventDate ? eventDate.toLocaleDateString() : t.events.eventDate}
              </Text>
            </Pressable>
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={eventDate || new Date()}
                mode="date"
                display="default"
                onChange={(_event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setEventDate(selectedDate);
                }}
              />
            )}
            {Platform.OS === 'ios' && (
              <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
                <View style={styles.datePickerOverlay}>
                  <View style={styles.datePickerSheet}>
                    <DateTimePicker
                      value={eventDate || new Date()}
                      mode="date"
                      display="inline"
                      onChange={(_event, selectedDate) => {
                        if (selectedDate) setEventDate(selectedDate);
                      }}
                    />
                    <Pressable style={styles.datePickerConfirmBtn} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.datePickerConfirmText}>{t.common.ok}</Text>
                    </Pressable>
                  </View>
                </View>
              </Modal>
            )}
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
  previewSection: { gap: Spacing.xs },
  previewOverline: {
    fontSize: 10, fontWeight: FontWeight.bold, color: Colors.TextMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  previewCard: { borderRadius: Radius.xl, overflow: 'hidden' },
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
});
