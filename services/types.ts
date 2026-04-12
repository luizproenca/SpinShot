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
