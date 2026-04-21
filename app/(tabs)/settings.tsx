import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { usePlan } from '../../hooks/usePlan';
import { getSupabaseClient } from '@/template';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { LANGUAGES } from '../../constants/config';
import { formatExpiryDate, getTrialRemainingDays } from '../../services/subscriptionService';
import * as Application from 'expo-application';

const PRO_BENEFITS = [
  { icon: 'hide-source', label: 'Sem marca d\'água em todos os vídeos' },
  { icon: 'hd', label: 'Exportação Full HD (1080p)' },
  { icon: 'all-inclusive', label: 'Eventos ilimitados' },
  { icon: 'timer', label: 'Vídeos acima de 10 segundos' },
  { icon: 'auto-awesome', label: 'Boomerang, Cinematic e Hype' },
  { icon: 'layers', label: 'Molduras e músicas premium' },
  { icon: 'business', label: 'Logo personalizada no evento' },
];

const FREE_BENEFITS = [
  { icon: 'hide-source', label: 'Sem marca d\'água' },
  { icon: 'hd', label: 'Exportação Full HD (1080p)' },
  { icon: 'all-inclusive', label: 'Eventos ilimitados' },
  { icon: 'timer', label: 'Vídeos acima de 10 segundos' },
  { icon: 'auto-awesome', label: 'Todos os efeitos liberados' },
  { icon: 'layers', label: 'Molduras e músicas premium' },
  { icon: 'business', label: 'Logo personalizada no evento' },
];

export default function SettingsScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const { subscription, isPro, isTrial, showPaywall, subscriptionLoading, restorePurchases, cancelSubscription } = usePlan();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';

  const [selectedLang, setSelectedLang] = useState(language);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  

  const handleSaveName = useCallback(async () => {
    if (!nameValue.trim()) {
      showAlert(t.settings.invalidName, t.settings.invalidNameMsg);
      return;
    }
    setSavingName(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: nameValue.trim() })
        .eq('id', user?.id);
      if (error) throw new Error(error.message);
      setEditingName(false);
      showAlert(t.settings.nameSaved, t.settings.nameSavedMsg);
    } catch (e: any) {
      showAlert(t.common.error, e.message || t.common.retry);
    } finally {
      setSavingName(false);
    }
  }, [nameValue, user?.id, t]);

  const handleAnalytics = () => {
    if (!isPro) {
      showPaywall('hd');
      return;
    }
    router.push('/analytics');
  };

  const handleDeleteAccount = () => {
    showAlert(
      t.settings.deleteAccountConfirm,
      t.settings.deleteAccountMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.settings.deleteAccount,
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setShowDeleteModal(true);
          },
        },
      ]
    );
  };

  const confirmDelete = async () => {
    const word = t.settings.deleteAccountConfirmWord;
    if (deleteConfirmText.trim().toUpperCase() !== word.toUpperCase()) {
      showAlert(t.common.error, `${t.settings.deleteAccountPlaceholder}: ${word}`);
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount();
      setShowDeleteModal(false);
      router.replace('/(auth)/login');
    } catch (e: any) {
      showAlert(t.common.error, e.message || t.settings.deleteAccountError);
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    showAlert(t.settings.logoutConfirm, t.settings.logoutMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.logout, style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    showAlert(t.settings.resetPassword, t.settings.resetPasswordMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.sendEmail,
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '');
            if (error) throw error;
            showAlert(t.settings.emailSent, t.settings.emailSentMsg);
          } catch (e: any) {
            showAlert(t.common.error, e.message || t.settings.resetPasswordMsg);
          }
        },
      },
    ]);
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.success) {
      if (result.restored) {
        showAlert(t.common.success, t.settings.restoreSuccess);
      } else {
        showAlert(t.common.error, t.settings.restoreNotFound);
      }
    } else {
      showAlert(t.common.error, t.settings.restoreError);
    }
  };

  const handleCancelSubscription = () => {
    showAlert(t.settings.cancelConfirm, t.settings.cancelMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.cancelSubscription, style: 'destructive',
        onPress: async () => {
          await cancelSubscription();
          showAlert(t.common.success, 'Assinatura cancelada. Você mantém o acesso até o final do período.');
        },
      },
    ]);
  };

  const initial = (user?.name || user?.email || 'U')[0].toUpperCase();

  // ── Subscription status helpers ────────────────────────────────────────
  const isActive = subscription.status === 'active';
  const isTrialActive = subscription.status === 'trial';
  const isExpired = subscription.status === 'expired' || subscription.status === 'cancelled';

  const planLabel = isPro
    ? (subscription.plan === 'pro_annual' ? t.settings.planAnnual : t.settings.planMonthly)
    : t.settings.freePlan;

  const planColor = isPro ? Colors.Primary : Colors.TextSubtle;
  const planBorderColor = isPro ? Colors.Primary + '44' : Colors.Border;
  const planBgColor = isPro ? Colors.Primary + '12' : Colors.Surface;

  const trialDaysLeft = getTrialRemainingDays(subscription.trialStartAt);
  const expiryFormatted = formatExpiryDate(subscription.expiresAt, language);

  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 0 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t.settings.title}</Text>

        {/* ─── User Card ─── */}
        <LinearGradient
          colors={['#1A1740', '#0F1235']}
          style={[styles.userCard, { borderColor: planBorderColor }]}
        >
          <LinearGradient colors={Colors.GradientBrand} style={styles.userAvatar}>
            <Text style={styles.userInitial}>{initial}</Text>
          </LinearGradient>

          <View style={styles.userInfo}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameValue}
                  onChangeText={setNameValue}
                  placeholder="Seu nome"
                  placeholderTextColor={Colors.TextMuted}
                  autoFocus
                  maxLength={40}
                  accessibilityLabel="Editar nome"
                />
                <Pressable style={[styles.saveNameBtn, { opacity: savingName ? 0.7 : 1 }]}
                  onPress={handleSaveName} disabled={savingName}>
                  <MaterialIcons name="check" size={17} color="#fff" />
                </Pressable>
                <Pressable style={styles.cancelNameBtn}
                  onPress={() => { setEditingName(false); setNameValue(user?.name || ''); }}>
                  <MaterialIcons name="close" size={17} color={Colors.TextMuted} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.nameRow}
                onPress={() => { setEditingName(true); setNameValue(user?.name || ''); }} hitSlop={4}>
                <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Usuário'}</Text>
                <MaterialIcons name="edit" size={14} color={Colors.TextMuted} />
              </Pressable>
            )}
            <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
          </View>

          <View style={[styles.planBadge, { borderColor: planBorderColor, backgroundColor: planBgColor }]}>
            {isPro && <MaterialIcons name="star" size={11} color={planColor} />}
            <Text style={[styles.planBadgeText, { color: planColor }]}>
              {isPro ? 'PRO' : 'FREE'}
            </Text>
          </View>
        </LinearGradient>

        {/* ─── PLAN SECTION ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.settings.plan}</Text>

          {/* Current Plan Card */}
          <LinearGradient
            colors={isPro ? ['#7C3AED22', '#4F46E518'] : ['#1A1740', '#12102A']}
            style={[styles.currentPlanCard, { borderColor: planBorderColor }]}
          >
            <View style={styles.currentPlanLeft}>
              <View style={[styles.currentPlanIcon, { backgroundColor: planColor + '22' }]}>
                <MaterialIcons name={isPro ? 'star' : 'lock-open'} size={22} color={planColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.currentPlanTitle}>
                  {isPro ? `SpinShot Pro · ${planLabel}` : 'Gratuito'}
                </Text>
                <Text style={styles.currentPlanSub}>
                  {isPro
                    ? t.settings.proPlanSub
                    : t.settings.freeSub}
                </Text>
              </View>
            </View>
            {!isPro && (
              <View style={styles.freeLimitBadge}>
                <Text style={styles.freeLimitText}>{t.settings.limited}</Text>
              </View>
            )}
          </LinearGradient>

          {/* Trial / Active / Expired status strip */}
          {isPro && (
            <View style={[
              styles.statusStrip,
              isTrialActive && { backgroundColor: Colors.Success + '18', borderColor: Colors.Success + '44' },
              isActive && !isTrialActive && { backgroundColor: Colors.Primary + '12', borderColor: Colors.Primary + '33' },
              isExpired && { backgroundColor: Colors.Error + '18', borderColor: Colors.Error + '44' },
            ]}>
              <MaterialIcons
                name={isTrialActive ? 'celebration' : isActive ? 'check-circle' : 'warning'}
                size={14}
                color={isTrialActive ? Colors.Success : isActive ? Colors.Primary : Colors.Error}
              />
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.statusText,
                  { color: isTrialActive ? Colors.Success : isActive ? Colors.Primary : Colors.Error },
                ]}>
                  {isTrialActive
                    ? `${t.settings.subscriptionTrial} · ${trialDaysLeft} ${t.settings.trialDaysLeft}`
                    : isActive
                    ? t.settings.subscriptionActive
                    : t.settings.subscriptionExpired}
                </Text>
                {subscription.expiresAt && (
                  <Text style={styles.statusSub}>
                    {isTrialActive
                      ? `${t.settings.trialEndsOn}: ${expiryFormatted}`
                      : `${t.settings.renewsOn}: ${expiryFormatted}`}
                  </Text>
                )}
              </View>
              {subscriptionLoading && <ActivityIndicator size="small" color={Colors.TextMuted} />}
            </View>
          )}

          {/* Benefits box */}
          <View style={styles.benefitsBox}>
            <Text style={styles.benefitsTitle}>
              {isPro ? t.settings.yourProBenefits : t.settings.whatYouGetPro}
            </Text>
            {(isPro ? PRO_BENEFITS : FREE_BENEFITS).map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={[
                  styles.benefitIcon,
                  { backgroundColor: isPro ? Colors.Success + '22' : Colors.Primary + '18' },
                ]}>
                  <MaterialIcons
                    name={b.icon as any}
                    size={14}
                    color={isPro ? Colors.Success : Colors.Primary + 'AA'}
                  />
                </View>
                <Text style={[styles.benefitText, !isPro && { color: Colors.TextMuted }]}>
                  {b.label}
                </Text>
                {!isPro && <MaterialIcons name="lock" size={12} color={Colors.TextMuted} />}
              </View>
            ))}
          </View>

          {/* Upgrade CTA (free users) */}
          {!isPro && (
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              onPress={() => showPaywall('generic')}
            >
              <LinearGradient
                colors={['#7C3AED', '#EC4899']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.upgradeCard}
              >
                <View style={styles.upgradeIcon}>
                  <MaterialIcons name="star" size={22} color="#F59E0B" />
                </View>
                <View style={styles.upgradeInfo}>
                  <Text style={styles.upgradeTitle}>{t.settings.upgradePro}</Text>
                  <Text style={styles.upgradeSub}>{t.settings.upgradeProSub}</Text>
                </View>
                <View style={styles.upgradePrice}>
                  <Text style={styles.upgradePriceText}>R$ 79,90</Text>
                  <Text style={styles.upgradePriceSub}>/mês</Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {/* Navigate to full subscription screen */}
          <Pressable
            style={({ pressed }) => [styles.manageRow, styles.manageBoxSingle, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => router.push('/subscription' as any)}
          >
            <View style={[styles.manageIcon, { backgroundColor: Colors.Primary + '18' }]}>
              <MaterialIcons name="credit-card" size={18} color={Colors.Primary} />
            </View>
            <Text style={[styles.manageText, { color: Colors.TextPrimary }]}>{t.settings.manageSubscription}</Text>
            <MaterialIcons name="chevron-right" size={18} color={Colors.TextMuted} />
          </Pressable>

          {/* Manage subscription (pro users) */}
          {isPro && (
            <View style={styles.manageBox}>
              <Pressable
                style={({ pressed }) => [styles.manageRow, { opacity: pressed ? 0.75 : 1 }]}
                onPress={handleRestorePurchases}
                disabled={restoring}
              >
                <View style={[styles.manageIcon, { backgroundColor: Colors.Primary + '18' }]}>
                  {restoring
                    ? <ActivityIndicator size="small" color={Colors.Primary} />
                    : <MaterialIcons name="restore" size={18} color={Colors.Primary} />}
                </View>
                <Text style={[styles.manageText, { color: Colors.TextPrimary }]}>{t.settings.restorePurchases}</Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.TextMuted} />
              </Pressable>

              <View style={styles.manageDivider} />

              <Pressable
                style={({ pressed }) => [styles.manageRow, { opacity: pressed ? 0.75 : 1 }]}
                onPress={handleCancelSubscription}
              >
                <View style={[styles.manageIcon, { backgroundColor: Colors.Error + '18' }]}>
                  <MaterialIcons name="cancel" size={18} color={Colors.Error} />
                </View>
                <Text style={[styles.manageText, { color: Colors.Error }]}>{t.settings.cancelSubscription}</Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.Error + '88'} />
              </Pressable>
            </View>
          )}

          {/* Restore for free users */}
          {!isPro && (
            <Pressable
              style={({ pressed }) => [styles.restoreLink, { opacity: pressed ? 0.7 : 1 }]}
              onPress={handleRestorePurchases}
              disabled={restoring}
            >
              {restoring
                ? <ActivityIndicator size="small" color={Colors.TextMuted} />
                : <Text style={styles.restoreLinkText}>{t.settings.restorePurchases}</Text>}
            </Pressable>
          )}
        </View>

        {/* ─── Language ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.settings.language}</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map(lang => (
              <Pressable
                key={lang.code}
                style={[
                  styles.langCard,
                  selectedLang === lang.code && {
                    borderColor: Colors.Primary,
                    backgroundColor: Colors.GlassMedium,
                  },
                ]}
                onPress={() => { setSelectedLang(lang.code as any); setLanguage(lang.code as any); }}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, selectedLang === lang.code && { color: Colors.Primary }]}>
                  {lang.label}
                </Text>
                {selectedLang === lang.code && (
                  <MaterialIcons name="check-circle" size={14} color={Colors.Primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ─── Account ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.settings.account}</Text>
          <View style={styles.menuBox}>
            <Pressable
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleAnalytics}
            >
              <View style={[styles.menuIcon, {
                backgroundColor: isPro ? '#7C3AED18' : Colors.Border,
              }]}>
                <MaterialIcons name="insights" size={18} color={isPro ? Colors.Primary : Colors.TextMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuText, { color: isPro ? Colors.TextPrimary : Colors.TextMuted }]}>
                  {t.settings.analytics}
                </Text>
                <Text style={{ color: Colors.TextMuted, fontSize: 10 }}>
                  {isPro ? t.settings.analyticsSub : t.settings.analyticsLocked}
                </Text>
              </View>
              {isPro
                ? <MaterialIcons name="chevron-right" size={18} color={Colors.TextMuted} />
                : (
                  <View style={styles.lockBadge}>
                    <MaterialIcons name="lock" size={11} color={Colors.TextMuted} />
                    <Text style={styles.lockBadgeText}>Pro</Text>
                  </View>
                )
              }
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleChangePassword}
            >
              <View style={[styles.menuIcon, { backgroundColor: Colors.Primary + '18' }]}>
                <MaterialIcons name="lock-reset" size={18} color={Colors.Primary} />
              </View>
              <Text style={[styles.menuText, { color: Colors.TextPrimary }]}>{t.settings.changePassword}</Text>
              <MaterialIcons name="chevron-right" size={18} color={Colors.TextMuted} />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleLogout}
            >
              <View style={[styles.menuIcon, { backgroundColor: Colors.Error + '18' }]}>
                <MaterialIcons name="logout" size={18} color={Colors.Error} />
              </View>
              <Text style={[styles.menuText, { color: Colors.Error }]}>{t.settings.logout}</Text>
              <MaterialIcons name="chevron-right" size={18} color={Colors.Error + '88'} />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={handleDeleteAccount}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FF000022' }]}>
                <MaterialIcons name="delete-forever" size={18} color="#FF3B30" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuText, { color: '#FF3B30' }]}>{t.settings.deleteAccount}</Text>
                <Text style={{ color: Colors.TextMuted, fontSize: 10, marginTop: 1 }}>
                  {t.settings.deleteAccountPermanentHint}
                  </Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color="#FF3B3066" />
            </Pressable>
          </View>
        </View>

      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deleting) setShowDeleteModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="warning" size={32} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>{t.settings.deleteAccountConfirm2}</Text>
            <Text style={styles.modalMsg}>{t.settings.deleteAccountMsg2}</Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={t.settings.deleteAccountPlaceholder}
              placeholderTextColor={Colors.TextMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              accessibilityLabel={t.settings.deleteAccountPlaceholder}
            />
            <Pressable
              style={({ pressed }) => [styles.modalDeleteBtn, {
                opacity: pressed || deleting ? 0.75 : 1,
                backgroundColor:
                  deleteConfirmText.trim().toUpperCase() === t.settings.deleteAccountConfirmWord.toUpperCase()
                    ? '#FF3B30' : '#FF3B3055',
              }]}
              onPress={confirmDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.modalDeleteBtnText}>{t.settings.deleteAccount}</Text>}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      
      <View style={[{ paddingHorizontal: Spacing.lg, paddingVertical: 4 }]}> 
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>SpinShot 360 · {t.settings.version} {version} • Build {build}</Text>
          <Text style={styles.appInfoSub}>{t.settings.allRights}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.TextPrimary },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1.5,
  },
  userAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 6,
  },
  userInitial: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  userInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { color: Colors.TextPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semibold, maxWidth: 160 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameInput: {
    flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.Primary, paddingVertical: 2,
  },
  saveNameBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.Primary,
  },
  cancelNameBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderWidth: 1, borderColor: Colors.Border,
  },
  userEmail: { color: Colors.TextSubtle, fontSize: FontSize.xs },
  planBadge: {
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1,
  },
  planBadgeText: { fontSize: 10, fontWeight: FontWeight.bold },

  section: { gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.TextSecondary },

  currentPlanCard: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1.5, gap: Spacing.md,
  },
  currentPlanLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, flex: 1, minWidth: 0 },
  currentPlanIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  currentPlanTitle: { color: Colors.TextPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold, lineHeight: 24 },
  currentPlanSub: { color: Colors.TextSubtle, fontSize: FontSize.xs, marginTop: 4, lineHeight: 18, flexShrink: 1 },
  freeLimitBadge: {
    backgroundColor: Colors.Error + '18', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.Error + '44',
    alignSelf: 'flex-start', flexShrink: 0,
  },
  freeLimitText: { color: Colors.Error, fontSize: 10, fontWeight: FontWeight.bold },

  statusStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  statusSub: { fontSize: 10, color: Colors.TextMuted, marginTop: 2 },

  benefitsBox: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.Border,
    padding: Spacing.md, gap: Spacing.md,
  },
  benefitsTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.TextMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  benefitIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm },

  upgradeCard: {
    borderRadius: Radius.xl, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    shadowColor: Colors.Primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  upgradeIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  upgradeInfo: { flex: 1 },
  upgradeTitle: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  upgradeSub: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs, marginTop: 2 },
  upgradePrice: { alignItems: 'center' },
  upgradePriceText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
  upgradePriceSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },

  manageBoxSingle: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border,
  },
  manageBox: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border, overflow: 'hidden',
  },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  manageIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  manageText: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  manageDivider: { height: 1, backgroundColor: Colors.Border, marginLeft: 52 },

  restoreLink: { alignSelf: 'center', padding: 4 },
  restoreLinkText: { color: Colors.TextMuted, fontSize: FontSize.xs, textDecorationLine: 'underline' },

  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langCard: {
    flex: 1, backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.Border,
    paddingVertical: Spacing.md, alignItems: 'center', gap: 4,
  },
  langFlag: { fontSize: 22 },
  langLabel: { color: Colors.TextSubtle, fontSize: 10, fontWeight: FontWeight.medium, textAlign: 'center' },

  menuBox: {
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.Border, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  menuDivider: { height: 1, backgroundColor: Colors.Border, marginLeft: 52 },

  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.SurfaceElevated, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.Border,
  },
  lockBadgeText: { color: Colors.TextMuted, fontSize: 9, fontWeight: FontWeight.semibold },

  appInfo: { alignItems: 'center', gap: 4, paddingBottom: Spacing.sm },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#1A1740', borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: '#FF3B3044',
    padding: Spacing.xl, gap: Spacing.md, alignItems: 'center',
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FF3B3022', borderWidth: 1.5, borderColor: '#FF3B3055',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  modalTitle: {
    color: Colors.TextPrimary, fontSize: FontSize.lg,
    fontWeight: FontWeight.bold, textAlign: 'center',
  },
  modalMsg: {
    color: Colors.TextSubtle, fontSize: FontSize.sm,
    textAlign: 'center', lineHeight: 20,
  },
  modalInput: {
    width: '100%', borderWidth: 1.5, borderColor: '#FF3B3066',
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
    color: Colors.TextPrimary, fontSize: FontSize.md,
    backgroundColor: Colors.Surface, textAlign: 'center',
    letterSpacing: 2, fontWeight: FontWeight.bold,
  },
  modalDeleteBtn: {
    width: '100%', paddingVertical: 14, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  modalDeleteBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 24 },
  modalCancelText: { color: Colors.TextMuted, fontSize: FontSize.sm },
  appInfoText: { color: Colors.TextMuted, fontSize: FontSize.xs },
  appInfoSub: { color: Colors.TextMuted, fontSize: 10 },
});
