/**
 * Video Effects Service
 *
 * Regras:
 * - usuário escolhe a duração final desejada
 * - gravamos somente o necessário para chegar nessa duração após o efeito
 * - o áudio acompanha a duração final esperada
 */

export type VideoPreset = 'boomerang' | 'cinematic' | 'hype';

export interface PresetConfig {
  playbackRate: number;
  loop: boolean;
  label: string;
  emoji: string;
  description: string;
}

export interface DurationPlan {
  sourceDuration: number;
  finalDuration: number;
  audioDuration: number;
  expectedMultiplier: number;
}

export const PRESET_CONFIGS: Record<VideoPreset, PresetConfig> = {
  boomerang: {
    playbackRate: 1,
    loop: true,
    label: 'Boomerang',
    emoji: '🔁',
    description: 'Ida e volta — efeito clássico',
  },
  cinematic: {
    playbackRate: 1,
    loop: true,
    label: 'Cinematic',
    emoji: '🎬',
    description: 'Slow + reverse suave',
  },
  hype: {
    playbackRate: 1,
    loop: true,
    label: 'Hype',
    emoji: '⚡',
    description: 'Rápido e impactante',
  },
};

export const DEFAULT_PRESET: VideoPreset = 'boomerang';
export const ALL_PRESETS: VideoPreset[] = ['boomerang', 'cinematic', 'hype'];

export function getEffectDurationMultiplier(preset: VideoPreset): number {
  switch (preset) {
    case 'cinematic':
      return 2.3;
    case 'hype':
      return 1.6;
    case 'boomerang':
    default:
      return 2;
  }
}

export function calculateDurationPlan(finalDuration: number, preset: VideoPreset): DurationPlan {
  const safeFinalDuration = Math.max(1, Math.ceil(finalDuration));
  const multiplier = getEffectDurationMultiplier(preset);
  const sourceDuration = Math.max(1, Math.ceil(safeFinalDuration / multiplier));

  return {
    sourceDuration,
    finalDuration: safeFinalDuration,
    audioDuration: safeFinalDuration,
    expectedMultiplier: multiplier,
  };
}

export function getPlayerConfig(
  preset: VideoPreset,
): Pick<PresetConfig, 'playbackRate' | 'loop'> {
  const config = PRESET_CONFIGS[preset] ?? PRESET_CONFIGS.boomerang;

  return {
    playbackRate: config.playbackRate,
    loop: config.loop,
  };
}

export function getPresetDescription(preset: VideoPreset): string {
  return PRESET_CONFIGS[preset]?.description ?? '';
}

export function isVideoPreset(value: string | undefined | null): value is VideoPreset {
  return value === 'boomerang' || value === 'cinematic' || value === 'hype';
}