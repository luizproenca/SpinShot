export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro';
  createdAt: string;
}

export interface Event {
  id: string;
  userId: string;
  name: string;
  color: string;
  logoUri?: string;
  music?: string;
  frameId?: string;
  frameCloudinaryId?: string;
  createdAt: string;
  videoCount: number;
  // Real-world date of the event — immutable once set (enforced server-side).
  // Anchors per-event Pro unlocks (free first event / one-off purchase) so
  // they apply around the actual event date, not the purchase/signup date.
  eventDate?: string;
  unlockSource?: 'purchase' | 'free_first_event';
}

export interface Video {
  id: string;
  eventId: string;
  eventName: string;
  eventColor: string;
  thumbnailUri?: string;
  videoUri?: string;
  effect: string;
  duration: number;
  shareUrl: string;
  shareCode: string;
  createdAt: string;
  downloads: number;
  // Anti-refund split for paid access (one-off purchase or subscription) —
  // null for the free first event, which never had a payment to refund.
  videoUrlWatermarked?: string;
  cleanAvailableAt?: string;
  // Set only by the reconcile-clean-video cron job once it re-confirms, at
  // hold expiry, that no refund landed — this (not cleanAvailableAt) is
  // what actually gates which URL is shown, see getDisplayVideoUrl.
  cleanConfirmedAt?: string;
}

export interface VideoFrame {
  id: string;
  userId?: string;
  name: string;
  cloudinaryPublicId: string;
  thumbnailUrl?: string;
  isPremium: boolean;
  isDefault: boolean;
  category?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}

export type RecordingEffect = 'slowmo' | 'boomerang' | 'reverse' | 'normal';
