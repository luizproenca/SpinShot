import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { GradientButton } from '../../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1A0533', '#0D1B4A', '#1A0533']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.orb1} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.TextSecondary} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>{t.auth.registerTitle}</Text>
            <Text style={styles.subtitle}>{t.auth.registerSubtitle}</Text>
          </View>

          <View style={styles.form}>
            {[
              { key: 'name', label: t.auth.completeName , value: name, setter: setName, icon: 'person', placeholder: t.auth.completeName, type: 'default', secure: false },
              { key: 'email', label: t.auth.email, value: email, setter: setEmail, icon: 'email', placeholder: 'email@example.com', type: 'email-address', secure: false },
              { key: 'pass', label: t.auth.password, value: password, setter: setPassword, icon: 'lock', placeholder: t.auth.password, type: 'default', secure: true },
            ].map((field) => (
              <View key={field.key} style={styles.inputGroup}>
                <Text style={styles.label}>{field.label}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name={field.icon as any} size={20} color={Colors.TextSubtle} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.TextMuted}
                    keyboardType={field.type as any}
                    autoCapitalize="none"
                    secureTextEntry={field.secure}
                    accessibilityLabel={field.label}
                  />
                </View>
              </View>
            ))}

            <GradientButton
              title={t.auth.register}
              onPress={handleRegister}
              loading={loading}
              style={styles.btn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t.auth.haveAccount}</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.footerLink}> {t.auth.login}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: Colors.Primary, opacity: 0.1, top: -80, left: -80,
  },
  keyboardView: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.xl },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  header: { gap: Spacing.sm },
  title: { fontSize: 28, fontWeight: FontWeight.bold, color: '#fff' },
  subtitle: { fontSize: FontSize.md, color: Colors.TextSecondary },
  form: { gap: Spacing.md },
  inputGroup: { gap: Spacing.sm },
  label: { color: Colors.TextSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.Border, paddingHorizontal: Spacing.md, height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.md },
  btn: { marginTop: Spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.TextSubtle, fontSize: FontSize.sm },
  footerLink: { color: Colors.Primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
