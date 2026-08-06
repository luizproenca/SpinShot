import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert, getSupabaseClient } from '@/template';
import { useLanguage } from '../../hooks/useLanguage';
import { GradientButton } from '../../components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

type Step = 'email' | 'otp' | 'password';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  // Sempre avança pro passo de código, exista ou não a conta — não dá pra
  // vazar pro usuário se um e-mail está cadastrado ou não.
  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      showAlert(t.auth.email, `${t.auth.email}.`);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.resetPasswordForEmail(email.trim());
      startCooldown();
      setStep('otp');
    } catch (e: any) {
      showAlert(t.common.error, e?.message || t.common.retry);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.resetPasswordForEmail(email.trim());
      startCooldown();
      showAlert(t.auth.resendCode, t.auth.verificationTitle);
    } catch (e: any) {
      showAlert(t.common.error, e?.message || t.common.retry);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      showAlert(t.auth.verificationCode, `${t.auth.verificationSubtitle} ${email}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery',
      });
      if (error) throw new Error(error.message);
      setStep('password');
    } catch (e: any) {
      showAlert(t.common.error, e?.message || t.auth.verificationCode);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      showAlert(t.common.error, t.auth.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert(t.common.error, t.auth.passwordsDontMatch);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      // verifyOtp(type:'recovery') já deixou uma sessão válida — não precisa
      // logar de novo, é só seguir pro app.
      showAlert(t.common.success, t.auth.passwordUpdated);
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert(t.common.error, e?.message || t.common.retry);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'otp') {
      setStep('email');
      setOtp('');
    } else if (step === 'password') {
      setStep('otp');
    } else {
      router.back();
    }
  };

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
          <Pressable style={styles.backBtn} onPress={goBack} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.TextSecondary} />
            <Text style={styles.backText}>{t.common.back}</Text>
          </Pressable>

          <View style={styles.iconWrap}>
            <LinearGradient colors={['#4F46E522', '#8B5CF622']} style={styles.iconBg}>
              <MaterialIcons
                name={step === 'password' ? 'lock-reset' : 'mark-email-read'}
                size={48}
                color={Colors.Primary}
              />
            </LinearGradient>
          </View>

          {step === 'email' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t.auth.forgotPasswordTitle}</Text>
                <Text style={styles.subtitle}>{t.auth.forgotPasswordSubtitle}</Text>
              </View>

              <View style={styles.form}>
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
                      autoFocus
                      accessibilityLabel={t.auth.email}
                    />
                  </View>
                </View>

                <GradientButton
                  title={loading ? t.common.loading : t.auth.sendCode}
                  onPress={handleSendCode}
                  loading={loading}
                  style={styles.submitBtn}
                />
              </View>
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t.auth.verificationTitle}</Text>
                <Text style={styles.subtitle}>{t.auth.verificationSubtitle}:</Text>
                <View style={styles.emailChip}>
                  <MaterialIcons name="email" size={14} color={Colors.Primary} />
                  <Text style={styles.emailChipText} numberOfLines={1}>{email}</Text>
                </View>
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>{t.auth.verificationCode}</Text>
                <View style={[styles.inputWrapper, styles.otpInputWrapper]}>
                  <MaterialIcons name="pin" size={22} color={Colors.Primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={otp}
                    onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={Colors.TextMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textContentType="oneTimeCode"
                    accessibilityLabel={t.auth.verificationCode}
                  />
                </View>

                <GradientButton
                  title={loading ? t.common.loading : t.auth.login}
                  onPress={handleVerifyOtp}
                  loading={loading}
                  style={styles.submitBtn}
                />

                <View style={styles.resendRow}>
                  <Text style={styles.footerText}>{t.auth.verificationCode}?</Text>
                  <Pressable onPress={handleResendCode} hitSlop={8} disabled={cooldown > 0}>
                    <Text style={[styles.footerLink, cooldown > 0 && styles.footerLinkDisabled]}>
                      {' '}{cooldown > 0 ? `${t.auth.resendCode} (${cooldown}s)` : t.auth.resendCode}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {step === 'password' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t.auth.newPassword}</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.auth.newPassword}</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="lock" size={20} color={Colors.TextSubtle} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder={t.auth.newPassword}
                      placeholderTextColor={Colors.TextMuted}
                      secureTextEntry={!showPass}
                      autoFocus
                      accessibilityLabel={t.auth.newPassword}
                    />
                    <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                      <MaterialIcons
                        name={showPass ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={Colors.TextSubtle}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.auth.confirmPassword}</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="lock" size={20} color={Colors.TextSubtle} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder={t.auth.confirmPassword}
                      placeholderTextColor={Colors.TextMuted}
                      secureTextEntry={!showPass}
                      accessibilityLabel={t.auth.confirmPassword}
                    />
                  </View>
                </View>

                <GradientButton
                  title={loading ? t.common.loading : t.auth.newPassword}
                  onPress={handleSetNewPassword}
                  loading={loading}
                  style={styles.submitBtn}
                />
              </View>
            </>
          )}

          <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8} style={styles.backToLoginRow}>
            <Text style={styles.footerLink}>{t.auth.backToLogin}</Text>
          </Pressable>
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

  iconWrap: { alignItems: 'center', marginTop: Spacing.lg },
  iconBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border,
  },

  header: { alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.TextSubtle, textAlign: 'center' },

  emailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.Primary + '44',
    paddingHorizontal: Spacing.md, paddingVertical: 8, maxWidth: '90%',
  },
  emailChipText: { color: Colors.Primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

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

  otpInputWrapper: { borderColor: Colors.Primary + '66', borderWidth: 1.5 },
  otpInput: { fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 12, textAlign: 'center' },

  resendRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.TextSubtle, fontSize: FontSize.sm },
  footerLink: { color: Colors.Primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  footerLinkDisabled: { color: Colors.TextMuted },

  backToLoginRow: { alignItems: 'center', marginTop: Spacing.md },
});
