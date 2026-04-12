import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────
interface DayData { day: string; label: string; downloads: number }
interface EventData { name: string; color: string; downloads: number; videos: number }
interface HourData { hour: number; label: string; count: number }

interface AnalyticsData {
  totalDownloads: number;
  totalVideos: number;
  totalEvents: number;
  avgDownloadsPerVideo: number;
  dailyDownloads: DayData[];
  topEvents: EventData[];
  peakHours: HourData[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${period}`;
}

// ─── Bar Chart ─────────────────────────────────────────────────────────────
function BarChart({
  data,
  color,
  maxVal,
  labelKey,
  valueKey,
  barWidth = 18,
  maxBars = 14,
}: {
  data: any[];
  color: string;
  maxVal: number;
  labelKey: string;
  valueKey: string;
  barWidth?: number;
  maxBars?: number;
}) {
  const displayData = data.slice(-maxBars);
  const maxV = Math.max(maxVal, 1);
  const chartH = 90;

  return (
    <View style={styles.chartWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        {displayData.map((item, i) => {
          const pct = (item[valueKey] || 0) / maxV;
          const barH = Math.max(3, pct * chartH);
          return (
            <View key={i} style={[styles.barGroup, { width: barWidth + 12 }]}>
              <Text style={styles.barValue}>
                {item[valueKey] > 0 ? item[valueKey] : ''}
              </Text>
              <View style={[styles.barTrack, { height: chartH }]}>
                <LinearGradient
                  colors={[color, color + '88']}
                  style={[styles.barFill, { height: barH }]}
                />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>
                {item[labelKey]}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color, subtitle,
}: {
  icon: string; label: string; value: string | number; color: string; subtitle?: string;
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      styles.statCard,
      { transform: [{ scale: scaleAnim }], opacity: opacityAnim, borderColor: color + '33' },
    ]}>
      <LinearGradient colors={[color + '22', color + '08']} style={styles.statCardGrad}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '22' }]}>
          <MaterialIcons name={icon as any} size={20} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {subtitle ? <Text style={styles.statSub}>{subtitle}</Text> : null}
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Event Row ─────────────────────────────────────────────────────────────
function EventRow({ event, max, rank }: { event: EventData; max: number; rank: number }) {
  const pct = max > 0 ? event.downloads / max : 0;
  const barW = Math.max(4, pct * (SCREEN_W - 160));

  return (
    <View style={styles.eventRow}>
      <View style={[styles.rankBadge, { backgroundColor: rank <= 3 ? Colors.Warning + '22' : Colors.SurfaceElevated }]}>
        <Text style={[styles.rankText, { color: rank <= 3 ? Colors.Warning : Colors.TextMuted }]}>
          #{rank}
        </Text>
      </View>
      <View style={styles.eventRowInfo}>
        <View style={styles.eventRowTop}>
          <View style={[styles.eventDot, { backgroundColor: event.color }]} />
          <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
          <View style={styles.eventRowStats}>
            <MaterialIcons name="download" size={11} color={Colors.TextMuted} />
            <Text style={styles.eventStatText}>{event.downloads}</Text>
            <Text style={styles.eventStatDot}>·</Text>
            <MaterialIcons name="videocam" size={11} color={Colors.TextMuted} />
            <Text style={styles.eventStatText}>{event.videos}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[event.color, event.color + '66']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: barW }]}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadAnalytics = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: videos, error } = await supabase
        .from('videos')
        .select('id, event_id, event_name, event_color, downloads, created_at')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = videos || [];

      // ── Totals ────────────────────────────────────────────────────────
      const totalDownloads = rows.reduce((s, r) => s + (r.downloads || 0), 0);
      const totalVideos = rows.length;
      const uniqueEvents = new Set(rows.map(r => r.event_id)).size;
      const avgDl = totalVideos > 0 ? Math.round((totalDownloads / totalVideos) * 10) / 10 : 0;

      // ── Daily downloads (last 30 days) ────────────────────────────────
      const days = getLast30Days();
      const dailyMap: Record<string, number> = {};
      rows.forEach(r => {
        const day = r.created_at.slice(0, 10);
        dailyMap[day] = (dailyMap[day] || 0) + (r.downloads || 0);
      });
      const dailyDownloads: DayData[] = days.map(d => ({
        day: d,
        label: formatDayLabel(d),
        downloads: dailyMap[d] || 0,
      }));

      // ── Top events ────────────────────────────────────────────────────
      const eventMap: Record<string, EventData> = {};
      rows.forEach(r => {
        const key = r.event_id || r.event_name;
        if (!eventMap[key]) {
          eventMap[key] = { name: r.event_name, color: r.event_color || Colors.Primary, downloads: 0, videos: 0 };
        }
        eventMap[key].downloads += r.downloads || 0;
        eventMap[key].videos += 1;
      });
      const topEvents = Object.values(eventMap)
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 6);

      // ── Peak hours ────────────────────────────────────────────────────
      const hourMap: Record<number, number> = {};
      rows.forEach(r => {
        const h = new Date(r.created_at).getHours();
        hourMap[h] = (hourMap[h] || 0) + 1;
      });
      const peakHours: HourData[] = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: formatHour(h),
        count: hourMap[h] || 0,
      })).filter(h => h.count > 0 || h.hour % 3 === 0);

      setData({
        totalDownloads,
        totalVideos,
        totalEvents: uniqueEvents,
        avgDownloadsPerVideo: avgDl,
        dailyDownloads,
        topEvents,
        peakHours,
      });

      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Analytics load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
  };

  const maxDaily = data ? Math.max(...data.dailyDownloads.map(d => d.downloads), 1) : 1;
  const maxHour  = data ? Math.max(...data.peakHours.map(h => h.count), 1) : 1;
  const maxEvent = data ? Math.max(...data.topEvents.map(e => e.downloads), 1) : 1;

  return (
    <LinearGradient colors={['#0D0820', '#0A0F2E', '#0D0820']} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={20} color={Colors.TextSubtle} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t.analytics.title}</Text>
          <View style={styles.premiumBadge}>
            <MaterialIcons name="diamond" size={10} color="#D97706" />
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={[styles.backBtn, { opacity: refreshing ? 0.5 : 1 }]}
          disabled={refreshing}
          hitSlop={12}
        >
          <MaterialIcons name="refresh" size={20} color={Colors.TextSubtle} />
        </Pressable>
      </View>

      {loading && !data ? (
        <View style={styles.loadingState}>
          <LinearGradient colors={['#7C3AED22', '#0D0820']} style={styles.loadingOrb} />
          <MaterialIcons name="insights" size={48} color={Colors.Primary + '55'} />
          <Text style={styles.loadingText}>{t.analytics.loading}</Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: Spacing.md, paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Period label */}
          <View style={styles.periodRow}>
            <MaterialIcons name="date-range" size={14} color={Colors.TextMuted} />
            <Text style={styles.periodText}>{t.analytics.last30Days}</Text>
          </View>

          {/* ── KPI Cards ── */}
          <View style={styles.kpiGrid}>
            <StatCard
              icon="download"
              label={t.analytics.totalDownloads}
              value={data?.totalDownloads ?? 0}
              color={Colors.Primary}
              subtitle={t.analytics.viaQR}
            />
            <StatCard
              icon="videocam"
              label={t.analytics.totalVideos}
              value={data?.totalVideos ?? 0}
              color="#10B981"
              subtitle={t.analytics.recorded}
            />
            <StatCard
              icon="celebration"
              label={t.analytics.totalEvents}
              value={data?.totalEvents ?? 0}
              color="#F59E0B"
              subtitle={t.analytics.active}
            />
            <StatCard
              icon="trending-up"
              label={t.analytics.average}
              value={data?.avgDownloadsPerVideo ?? 0}
              color="#EC4899"
              subtitle={t.analytics.downloadsPerVideo}
            />
          </View>

          {/* ── Downloads por dia ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.Primary }]} />
              <Text style={styles.sectionTitle}>{t.analytics.downloadsByDay}</Text>
              <Text style={styles.sectionTotal}>
                {t.analytics.total}: {data?.totalDownloads ?? 0}
              </Text>
            </View>
            {data && data.dailyDownloads.every(d => d.downloads === 0) ? (
              <View style={styles.emptyChart}>
                <MaterialIcons name="bar-chart" size={32} color={Colors.Border} />
                <Text style={styles.emptyChartText}>{t.analytics.noDownloads}</Text>
              </View>
            ) : (
              <BarChart
                data={data?.dailyDownloads ?? []}
                color={Colors.Primary}
                maxVal={maxDaily}
                labelKey="label"
                valueKey="downloads"
                barWidth={16}
                maxBars={30}
              />
            )}
          </View>

          {/* ── Top Eventos ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.sectionTitle}>{t.analytics.topEvents}</Text>
            </View>
            {data?.topEvents.length === 0 ? (
              <View style={styles.emptyChart}>
                <MaterialIcons name="celebration" size={32} color={Colors.Border} />
                <Text style={styles.emptyChartText}>{t.analytics.noEvents}</Text>
              </View>
            ) : (
              <View style={styles.eventList}>
                {(data?.topEvents ?? []).map((ev, i) => (
                  <EventRow key={i} event={ev} max={maxEvent} rank={i + 1} />
                ))}
              </View>
            )}
          </View>

          {/* ── Horários de pico ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#EC4899' }]} />
              <Text style={styles.sectionTitle}>{t.analytics.peakHours}</Text>
            </View>
            {data && data.peakHours.every(h => h.count === 0) ? (
              <View style={styles.emptyChart}>
                <MaterialIcons name="schedule" size={32} color={Colors.Border} />
                <Text style={styles.emptyChartText}>{t.analytics.noPeakHours}</Text>
              </View>
            ) : (
              <>
                <BarChart
                  data={data?.peakHours ?? []}
                  color="#EC4899"
                  maxVal={maxHour}
                  labelKey="label"
                  valueKey="count"
                  barWidth={20}
                  maxBars={24}
                />
                {data && (
                  <View style={styles.peakInsight}>
                    <MaterialIcons name="tips-and-updates" size={14} color={Colors.Warning} />
                    <Text style={styles.peakInsightText}>
                      {(() => {
                        const peak = data.peakHours.reduce(
                          (max, h) => h.count > max.count ? h : max,
                          data.peakHours[0]
                        );
                        return peak?.count > 0
                          ? (peak.count > 1
                              ? t.analytics.peakAtPlural.replace('{{hour}}', formatHour(peak.hour)).replace('{{count}}', String(peak.count))
                              : t.analytics.peakAt.replace('{{hour}}', formatHour(peak.hour)).replace('{{count}}', String(peak.count)))
                          : t.analytics.noPeak;
                      })()}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Tip card ── */}
          <LinearGradient
            colors={['#7C3AED18', '#EC489912']}
            style={styles.tipCard}
          >
            <MaterialIcons name="lightbulb" size={20} color={Colors.Warning} />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>{t.analytics.tip}</Text>
              <Text style={styles.tipText}>{t.analytics.tipText}</Text>
            </View>
          </LinearGradient>
        </Animated.ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.Border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.SurfaceElevated, borderWidth: 1, borderColor: Colors.Border,
  },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.TextPrimary },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D9770618', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#D9770644',
  },
  premiumBadgeText: { color: '#D97706', fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5 },

  loadingState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  loadingOrb: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    top: '30%',
  },
  loadingText: { color: Colors.TextSubtle, fontSize: FontSize.sm },

  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },

  periodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  periodText: { color: Colors.TextMuted, fontSize: FontSize.xs },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    width: (SCREEN_W - Spacing.lg * 2 - Spacing.sm) / 2,
    borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden',
  },
  statCardGrad: { padding: Spacing.md, gap: 6 },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  statValue: { fontSize: FontSize.xxl + 4, fontWeight: FontWeight.extrabold, color: Colors.TextPrimary },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.TextSecondary },
  statSub: { fontSize: 10, color: Colors.TextMuted },

  section: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.Border,
    padding: Spacing.md, gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.TextPrimary },
  sectionTotal: { fontSize: 11, color: Colors.TextMuted },

  chartWrap: { height: 140 },
  chartScroll: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 4, gap: 2,
  },
  barGroup: { alignItems: 'center', gap: 4 },
  barValue: { fontSize: 8, color: Colors.TextMuted, height: 12 },
  barTrack: {
    width: '100%', justifyContent: 'flex-end',
    backgroundColor: Colors.Border + '55', borderRadius: 4, overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 7, color: Colors.TextMuted, textAlign: 'center' },

  emptyChart: {
    alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm,
  },
  emptyChartText: { color: Colors.TextMuted, fontSize: FontSize.xs, textAlign: 'center' },

  eventList: { gap: Spacing.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.Border,
  },
  rankText: { fontSize: 10, fontWeight: FontWeight.bold },
  eventRowInfo: { flex: 1, gap: 6 },
  eventRowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventName: { flex: 1, color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  eventRowStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventStatText: { color: Colors.TextMuted, fontSize: 10 },
  eventStatDot: { color: Colors.TextMuted, fontSize: 10 },
  progressTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: Colors.Border + '55', overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },

  peakInsight: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.Warning + '12',
    borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.Warning + '22',
  },
  peakInsightText: { flex: 1, color: Colors.TextSubtle, fontSize: FontSize.xs },

  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    borderRadius: Radius.xl, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.Primary + '22',
  },
  tipContent: { flex: 1, gap: 4 },
  tipTitle: { color: Colors.TextPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  tipText: { color: Colors.TextSubtle, fontSize: FontSize.xs, lineHeight: 20 },
});
