import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
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
import { getSupabaseClient } from '@/template';

type Mode = 'login' | 'register';
type Step = 'form' | 'otp';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateToOtp = () => {
    Animated.timing(slideAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    setStep('otp');
  };

  const animateBack = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    setStep('form');
    setOtp('');
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      showAlert(t.auth.email, `${t.auth.email}.`);
      return;
    }
    if (!password.trim() || password.length < 6) {
      showAlert(t.auth.password, `${t.auth.password}.`);
      return;
    }
    if (mode === 'register' && !name.trim()) {
      showAlert(t.auth.registerTitle, t.auth.registerSubtitle);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        router.replace('/(tabs)');
      } else {
        const { needsEmailConfirmation } = await register(name.trim(), email.trim(), password);
        if (needsEmailConfirmation) {
          animateToOtp();
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (e: any) {
      const msg = e.message || t.common.retry;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already')) {
        showAlert(t.auth.haveAccount, t.auth.login);
      } else {
        showAlert(t.common.error, msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 4) {
      showAlert(t.auth.verificationCode, `${t.auth.verificationSubtitle} ${email}`);
      return;
    }
    setVerifying(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'signup',
      });
      if (error) throw new Error(error.message);
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e.message || t.auth.verificationCode;
      showAlert(t.common.error, msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
      showAlert(t.auth.resendCode, t.auth.verificationTitle);
    } catch (e: any) {
      showAlert(t.common.error, e.message);
    }
  };

  const toggleMode = () => {
    setMode(m => (m === 'login' ? 'register' : 'login'));
    setName('');
    setEmail('');
    setPassword('');
    setOtp('');
    setStep('form');
  };

  // ── OTP Verification Screen ─────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <LinearGradient
        colors={['#1A0533', '#0D1B4A', '#1A0533']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <View style={styles.orb1} />
        <View style={styles.orb2} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.backBtn} onPress={animateBack} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={22} color={Colors.TextSecondary} />
              <Text style={styles.backText}>{t.common.back}</Text>
            </Pressable>

            <View style={styles.otpIconWrap}>
              <LinearGradient colors={['#4F46E522', '#8B5CF622']} style={styles.otpIconBg}>
                <MaterialIcons name="mark-email-read" size={48} color={Colors.Primary} />
              </LinearGradient>
            </View>

            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>{t.auth.verificationTitle}</Text>
              <Text style={styles.otpSubtitle}>{t.auth.verificationSubtitle}:</Text>
              <View style={styles.emailChip}>
                <MaterialIcons name="email" size={14} color={Colors.Primary} />
                <Text style={styles.emailChipText} numberOfLines={1}>{email}</Text>
              </View>
            </View>

            <View style={styles.otpForm}>
              <Text style={styles.label}>{t.auth.verificationCode}</Text>
              <View style={[styles.inputWrapper, styles.otpInputWrapper]}>
                <MaterialIcons name="pin" size={22} color={Colors.Primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="0000"
                  placeholderTextColor={Colors.TextMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  accessibilityLabel={t.auth.verificationCode}
                />
              </View>
              <Text style={styles.otpHint}>{t.auth.verificationSubtitle} {email}</Text>
            </View>

            <GradientButton
              title={verifying ? t.common.loading : t.auth.login}
              onPress={handleVerifyOtp}
              loading={verifying}
              style={styles.submitBtn}
            />

            <View style={styles.resendRow}>
              <Text style={styles.footerText}>{t.auth.verificationCode}?</Text>
              <Pressable onPress={handleResendOtp} hitSlop={8}>
                <Text style={styles.footerLink}> {t.auth.resendCode}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ── Login / Register Form ────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={['#1A0533', '#0D1B4A', '#1A0533']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.logo}>SpinShot 360</Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? t.auth.loginSubtitle : t.auth.registerSubtitle}
            </Text>
          </View>

          <View style={styles.modeTabs}>
            {(['login', 'register'] as Mode[]).map(m => (
              <Pressable
                key={m}
                style={[styles.modeTab, mode === m && styles.modeTabActive]}
                onPress={() => { setMode(m); setName(''); setEmail(''); setPassword(''); }}
              >
                <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                  {m === 'login' ? t.auth.login : t.auth.register}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.form}>
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.auth.email}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="person" size={20} color={Colors.TextSubtle} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder={t.auth.email}
                    placeholderTextColor={Colors.TextMuted}
                    autoCapitalize="words"
                    accessibilityLabel={t.auth.email}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.email}</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color={Colors.TextSubtle} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={Colors.TextMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={t.auth.email}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.auth.password}</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color={Colors.TextSubtle} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.auth.password}
                  placeholderTextColor={Colors.TextMuted}
                  secureTextEntry={!showPass}
                  accessibilityLabel={t.auth.password}
                />
                <Pressable onPress={() => setShowPass(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <MaterialIcons
                    name={showPass ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={Colors.TextSubtle}
                  />
                </Pressable>
              </View>
            </View>

            <GradientButton
              title={mode === 'login' ? t.auth.login : t.auth.register}
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === 'login' ? t.auth.noAccount : t.auth.haveAccount}
            </Text>
            <Pressable onPress={toggleMode} hitSlop={8}>
              <Text style={styles.footerLink}>
                {mode === 'login' ? ` ${t.auth.register}` : ` ${t.auth.login}`}
              </Text>
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
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: Colors.Primary, opacity: 0.12, top: -60, right: -60,
  },
  orb2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.Accent, opacity: 0.1, bottom: 100, left: -60,
  },
  keyboardView: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center', gap: Spacing.xl },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.sm, alignSelf: 'flex-start',
  },
  backText: { color: Colors.TextSecondary, fontSize: FontSize.sm },

  header: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  logo: { fontSize: 32, fontWeight: FontWeight.extrabold, color: '#fff', letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.md, color: Colors.TextSecondary },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    padding: 4,
  },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
  modeTabActive: { backgroundColor: Colors.Primary },
  modeTabText: { color: Colors.TextSubtle, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  modeTabTextActive: { color: '#fff' },

  form: { gap: Spacing.lg },
  inputGroup: { gap: Spacing.sm },
  label: { color: Colors.TextSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.Border, paddingHorizontal: Spacing.md, height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.md },
  eyeBtn: { padding: 4 },
  submitBtn: { marginTop: Spacing.sm },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  footerText: { color: Colors.TextSubtle, fontSize: FontSize.sm },
  footerLink: { color: Colors.Primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  otpIconWrap: { alignItems: 'center', marginTop: Spacing.lg },
  otpIconBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border,
  },

  otpHeader: { alignItems: 'center', gap: Spacing.sm },
  otpTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary, textAlign: 'center' },
  otpSubtitle: { fontSize: FontSize.sm, color: Colors.TextSubtle, textAlign: 'center' },

  emailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.Primary + '44',
    paddingHorizontal: Spacing.md, paddingVertical: 8, maxWidth: '90%',
  },
  emailChipText: { color: Colors.Primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  otpForm: { gap: Spacing.sm },
  otpInputWrapper: { borderColor: Colors.Primary + '66', borderWidth: 1.5 },
  otpInput: { fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 12, textAlign: 'center' },
  otpHint: { color: Colors.TextMuted, fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },

  resendRow: { flexDirection: 'row', justifyContent: 'center' },
});
