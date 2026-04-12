// SpinShot 360 Design System
export const Colors = {
  // Brand
  Primary: '#8B5CF6',       // Purple
  Secondary: '#3B82F6',     // Blue
  Accent: '#EC4899',        // Pink

  // Gradients (as arrays for LinearGradient)
  GradientBrand: ['#8B5CF6', '#3B82F6', '#EC4899'] as string[],
  GradientDark: ['#1A0533', '#0D1B3E', '#1A0533'] as string[],
  GradientCard: ['#1E1040', '#0F1F4A'] as string[],
  GradientRecording: ['#4C0519', '#1A0533'] as string[],
  GradientSuccess: ['#065F46', '#1A0533'] as string[],

  // Surfaces
  Background: '#07050F',
  Surface: '#12102A',
  SurfaceElevated: '#1A1740',
  SurfaceBright: '#22204E',
  Border: 'rgba(139, 92, 246, 0.25)',
  BorderBright: 'rgba(139, 92, 246, 0.6)',

  // Text
  TextPrimary: '#FFFFFF',
  TextSecondary: '#C4B5FD',
  TextSubtle: '#7C6FA0',
  TextMuted: '#4A4169',

  // Semantic
  Success: '#10B981',
  Error: '#EF4444',
  Warning: '#F59E0B',
  Recording: '#EF4444',

  // Overlay
  Overlay: 'rgba(7, 5, 15, 0.85)',
  GlassLight: 'rgba(255, 255, 255, 0.08)',
  GlassMedium: 'rgba(139, 92, 246, 0.15)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 48,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  glow: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  glowPink: {
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
