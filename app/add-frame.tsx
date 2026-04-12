import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useAlert } from '@/template';
import { useFrames } from '../hooks/useFrames';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

const PREVIEW_DANCER_URL = 'https://via.placeholder.com/400x711/transparent/ffffff?text=Moldura+Preview';

export default function AddFrameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uploadFrame } = useFrames();
  const { t } = useLanguage();
  const { showAlert } = useAlert();

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [frameName, setFrameName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<'uploading' | 'saving' | null>(null);

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.uri.toLowerCase().endsWith('.png') && asset.mimeType !== 'image/png') {
      showAlert(t.frames.invalidFormat, t.frames.invalidFormatMsg);
      return;
    }

    setLocalUri(asset.uri);
  };

  const handleUpload = async () => {
    if (!localUri || !frameName.trim()) {
      showAlert(t.frames.nameFrame, t.frames.nameFrameRequired);
      return;
    }

    setUploading(true);
    try {
      await uploadFrame(localUri, frameName.trim(), (s) => setStep(s));
      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
      showAlert(t.common.success, t.frames.uploadSuccess, [
        { text: t.common.ok, onPress: () => router.back() },
      ]);
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    } finally {
      setUploading(false);
      setStep(null);
    }
  };

  const getStepLabel = () => {
    if (step === 'uploading') return t.frames.stepUploading;
    if (step === 'saving') return t.frames.stepSaving;
    return t.frames.uploading;
  };

  return (
    <LinearGradient colors={['#0D0820', '#1A0533', '#0A0F2E']} style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.TextSecondary} />
          </Pressable>
          <Text style={styles.title}>{t.frames.addFrame}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info-outline" size={16} color={Colors.Primary} />
          <Text style={styles.infoText}>{t.frames.requirements}</Text>
        </View>

        {/* Preview Composition */}
        <View style={styles.previewWrap}>
          <Text style={styles.previewLabel}>{t.frames.previewLabel}</Text>
          <View style={styles.previewComposition}>
            {/* Background: simulated video with dark gradient */}
            <LinearGradient
              colors={['#2D1B69', '#1a1040', '#0D0820']}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Simulated dancer silhouette in center */}
            <View style={styles.dancerWrap}>
              <MaterialIcons name="person" size={96} color="rgba(255,255,255,0.18)" />
              <Text style={styles.dancerLabel}>{t.frames.dancerLabel}</Text>
            </View>

            {/* Frame overlay if picked */}
            {localUri ? (
              <Image
                source={{ uri: localUri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                transition={200}
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialIcons name="layers" size={36} color="rgba(255,255,255,0.2)" />
                <Text style={styles.previewPlaceholderText}>{t.frames.previewPlaceholder}</Text>
              </View>
            )}

            {/* Aspect ratio indicator */}
            <View style={styles.aspectBadge}>
              <Text style={styles.aspectBadgeText}>9:16</Text>
            </View>
          </View>
        </View>

        {/* Pick PNG Button */}
        <Pressable
          style={({ pressed }) => [styles.pickBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={handlePick}
        >
          <LinearGradient colors={['#1E1B3A', '#12102A']} style={styles.pickBtnInner}>
            <MaterialIcons
              name={localUri ? 'check-circle' : 'add-photo-alternate'}
              size={20}
              color={localUri ? Colors.Success : Colors.Primary}
            />
            <Text style={[styles.pickBtnText, localUri && { color: Colors.Success }]}>
              {localUri ? t.frames.imageSelected : t.frames.pickPng}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-right"
              size={18}
              color={Colors.TextMuted}
            />
          </LinearGradient>
        </Pressable>

        {/* Frame Name Input */}
        <View style={styles.section}>
          <Text style={styles.label}>{t.frames.frameName}</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="label" size={18} color={Colors.TextSubtle} />
            <Text
              style={[styles.nameInput, !frameName && { color: Colors.TextMuted }]}
              onPress={() => {
                Alert.prompt
                  ? Alert.prompt(
                      t.frames.frameName,
                      t.frames.frameNamePlaceholder,
                      (val) => { if (val?.trim()) setFrameName(val.trim()); },
                      'plain-text',
                      frameName,
                    )
                  : showAlert(t.frames.frameName, t.frames.frameNamePlaceholder);
              }}
            >
              {frameName || t.frames.frameNamePlaceholder}
            </Text>
          </View>
        </View>

        {/* Requirements Checklist */}
        <View style={styles.checkList}>
          {[
            { key: 'png', label: t.frames.reqPng, ok: !!localUri },
            { key: 'ratio', label: t.frames.req916, ok: !!localUri },
            { key: 'transparent', label: t.frames.reqTransparent, ok: !!localUri },
            { key: 'name', label: t.frames.reqName, ok: !!frameName.trim() },
          ].map(item => (
            <View key={item.key} style={styles.checkItem}>
              <MaterialIcons
                name={item.ok ? 'check-circle' : 'radio-button-unchecked'}
                size={16}
                color={item.ok ? Colors.Success : Colors.TextMuted}
              />
              <Text style={[styles.checkItemText, item.ok && { color: Colors.TextSecondary }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Upload Button */}
        <Pressable
          style={({ pressed }) => [
            styles.uploadBtn,
            { opacity: pressed || uploading || !localUri || !frameName.trim() ? 0.7 : 1 },
          ]}
          onPress={handleUpload}
          disabled={uploading || !localUri || !frameName.trim()}
        >
          <LinearGradient
            colors={['#C084FC', '#8B5CF6', '#4F46E5']}
            style={styles.uploadBtnGrad}
          >
            {uploading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.uploadBtnText}>{getStepLabel()}</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="cloud-upload" size={22} color="#fff" />
                <Text style={styles.uploadBtnText}>{t.frames.uploadBtn}</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  backBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderRadius: 22,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.Primary + '12',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.Primary + '2A',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  infoText: { flex: 1, color: Colors.TextSubtle, fontSize: FontSize.xs, lineHeight: 18 },

  previewWrap: { gap: Spacing.sm },
  previewLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.TextSecondary },
  previewComposition: {
    height: 320, borderRadius: Radius.xl, overflow: 'hidden',
    backgroundColor: '#0D0820', position: 'relative',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border,
  },
  dancerWrap: { alignItems: 'center', gap: 4, zIndex: 1 },
  dancerLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  previewPlaceholder: {
    position: 'absolute', alignItems: 'center', gap: 8, zIndex: 2,
  },
  previewPlaceholderText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center' },
  aspectBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  aspectBadgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: FontWeight.bold },

  pickBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
  pickBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.Border, borderRadius: Radius.lg,
  },
  pickBtnText: { flex: 1, color: Colors.TextSubtle, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  section: { gap: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.TextSecondary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.Border,
    paddingHorizontal: Spacing.md, height: 52,
  },
  nameInput: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.md },

  checkList: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkItemText: { color: Colors.TextMuted, fontSize: FontSize.sm },

  uploadBtn: { borderRadius: Radius.full, overflow: 'hidden' },
  uploadBtnGrad: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.full,
  },
  uploadBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
