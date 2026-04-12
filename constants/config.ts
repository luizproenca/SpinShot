export const APP_NAME = 'SpinShot 360';

export const RECORDING_DURATIONS = [
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
  { label: '20s', value: 20 },
];

/** Legacy alias — use PRESET_CONFIGS from videoEffectsService for logic */
export const VIDEO_EFFECTS = [
  { id: 'suave',       label: 'Suave',       icon: 'auto-awesome', emoji: '✨' },
  { id: 'equilibrado', label: 'Equilibrado', icon: 'loop',         emoji: '🔁' },
  { id: 'impactante',  label: 'Impactante',  icon: 'bolt',         emoji: '⚡' },
];

export const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export const PLANS = {
  free: {
    name: 'Free',
    features: ['Marca d\'água', 'Limite de 10 vídeos/mês', 'Efeitos básicos'],
  },
  pro: {
    name: 'Pro',
    features: ['Sem marca d\'água', 'Branding personalizado', 'Downloads ilimitados', 'Todos os efeitos'],
    price: 'R$ 149/mês',
  },
};

export const EVENT_COLORS = [
  '#8B5CF6', '#3B82F6', '#EC4899',
  '#10B981', '#F59E0B', '#EF4444',
  '#06B6D4', '#8B5CF6', '#F97316',
];

export const MOCK_QR_BASE_URL = 'https://spinshot360.app/v/';

/**
 * Cloudinary cloud name — used to build preview URLs for music tracks.
 * The actual cloud name is stored in CLOUDINARY_CLOUD_NAME env secret on the backend;
 * on the client side, we derive it from the public Cloudinary URL pattern.
 * Override this if you have a specific cloud name.
 */
export const CLOUDINARY_CLOUD_NAME = 'dxxxxxxxxxxx'; // placeholder — actual name not needed client-side for preview
