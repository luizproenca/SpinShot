/**
 * SpinShot 360 — Funnel analytics
 * Minimal fire-and-forget event log (funnel_events table) so we can see
 * where users drop off between viewing the paywall and completing a
 * purchase. Never throws — a logging failure must not break the app.
 */

import { getSupabaseClient } from '@/template';

export type FunnelEventType =
  | 'paywall_viewed'
  | 'purchase_attempted'
  | 'purchase_completed'
  | 'purchase_failed';

export function logFunnelEvent(
  userId: string | undefined,
  eventType: FunnelEventType,
  trigger?: string,
  metadata?: Record<string, unknown>,
): void {
  if (!userId) return;

  try {
    const supabase = getSupabaseClient();
    supabase
      .from('funnel_events')
      .insert({ user_id: userId, event_type: eventType, trigger: trigger ?? null, metadata: metadata ?? null })
      .then(({ error }: { error: unknown }) => {
        if (error) console.warn('[funnelAnalytics] insert failed:', error);
      });
  } catch (e) {
    console.warn('[funnelAnalytics] logFunnelEvent error:', e);
  }
}
