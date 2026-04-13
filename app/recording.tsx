import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Pressable, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';
import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import { useLanguage } from '../hooks/useLanguage';
import {
  calculateDurationPlan,
  DEFAULT_PRESET,
  isVideoPreset,
  PRESET_CONFIGS,
  VideoPreset,
} from '../services/videoEffectsService';

type Phase = 'permissions' | 'countdown' | 'recording' | 'done';

const ORB_SIZE = 110;
const RING_SIZE = 120;
const ORB_STAGE_SIZE = 220;

export default function RecordingScreen() {
  const {
    duration,
    effect,
    eventId,
    eventName,
    eventColor,
    logoUrl,
    kioskMode,
    musicSelection,
    frameCloudinaryId,
  } = useLocalSearchParams<{
    duration: string;
    effect: string;
    eventId: string;
    eventName: string;
    eventColor: string;
    logoUrl?: string;
    kioskMode?: string;
    musicSelection?: string;
    frameCloudinaryId?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const preset: VideoPreset = isVideoPreset(effect) ? effect : DEFAULT_PRESET;
  const presetConfig = PRESET_CONFIGS[preset];

  const finalDuration = parseInt(duration || '15', 10);
  const durationPlan = calculateDurationPlan(finalDuration, preset);
  const totalDuration = durationPlan.sourceDuration;

  const [phase, setPhase] = useState<Phase>('permissions');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<CameraType>('front');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [localVideoUri, setLocalVideoUri] = useState<string | undefined>(undefined);

  const { t } = useLanguage();
  const cameraRef = useRef<CameraView>(null);
  const recordingStartedRef = useRef(false);
  const isIosSimulator = Platform.OS === 'ios' && !Device.isDevice;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressGlowAnim = useRef(new Animated.Value(0.6)).current;
  const countScale = useRef(new Animated.Value(0.5)).current;
  const countOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.8)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.5)).current;
  const ring3Scale = useRef(new Animated.Value(1)).current;
  const ring3Opacity = useRef(new Animated.Value(0.3)).current;
  const recDotOpacity = useRef(new Animated.Value(1)).current;
  const doneScale = useRef(new Animated.Value(0)).current;
  const cameraOpacity = useRef(new Animated.Value(0)).current;

  const displayedElapsed = Math.min(
    Math.round((elapsed / Math.max(totalDuration, 1)) * finalDuration),
    finalDuration,
  );
  const remaining = Math.max(finalDuration - displayedElapsed, 0);
  const recordingHint = isIosSimulator
    ? `Simulador iOS: gravação simulada (${finalDuration}s)`
    : `Gravando ${totalDuration}s → Gerando ${finalDuration}s`;

  const safeStopRecording = useCallback(async () => {
    if (isIosSimulator) {
      return;
    }

    try {
      await cameraRef.current?.stopRecording();
    } catch (error: any) {
      const message = String(error?.message ?? error);

      const isSimulatorUnsupported =
        Platform.OS === 'ios' &&
        message.toLowerCase().includes('not supported on the simulator');

      if (isSimulatorUnsupported) {
        console.log('stopRecording ignorado no simulador iOS');
        return;
      }

      console.error('Erro ao parar gravação:', error);
    }
  }, [isIosSimulator]);

  useEffect(() => {
    (async () => {
      let camOk = cameraPermission?.granted;
      let micOk = micPermission?.granted;

      if (!camOk) {
        const res = await requestCameraPermission();
        camOk = res.granted;
      }

      if (!micOk) {
        const res = await requestMicPermission();
        micOk = res.granted;
      }

      if (!camOk || !micOk) {
        Alert.alert(
          t.recording.permissionTitle,
          t.recording.permissionMsg,
          [{ text: t.common.ok, onPress: () => router.back() }],
        );
        return;
      }

      setTimeout(() => {
        Animated.timing(cameraOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
        setPhase('countdown');
      }, 300);
    })();
  }, [
    cameraOpacity,
    cameraPermission?.granted,
    micPermission?.granted,
    requestCameraPermission,
    requestMicPermission,
    router,
    t.common.ok,
    t.recording.permissionMsg,
    t.recording.permissionTitle,
  ]);

  const haptic = useCallback(async (style?: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      try {
        if (style !== undefined) await Haptics.impactAsync(style);
        else await Haptics.selectionAsync();
      } catch {}
    }
  }, []);

  const animateCountNumber = useCallback(() => {
    countScale.setValue(0.4);
    countOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(countScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(countOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [countOpacity, countScale]);

  useEffect(() => {
    if (phase !== 'countdown') return;

    animateCountNumber();
    haptic(Haptics.ImpactFeedbackStyle.Light);

    const interval = setInterval(async () => {
      await haptic(Haptics.ImpactFeedbackStyle.Medium);

      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          setPhase('recording');
          return 0;
        }
        animateCountNumber();
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [animateCountNumber, haptic, phase]);

  useEffect(() => {
    if (phase !== 'recording') return;

    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    recordingStartedRef.current = false;
    progressAnim.setValue(0);

    const startRecording = async () => {
      if (recordingStartedRef.current) return;
      recordingStartedRef.current = true;

      if (isIosSimulator) {
        console.log('Simulador iOS detectado: gravação será simulada.');
        return;
      }

      if (!cameraRef.current) return;

      try {
        const result = await cameraRef.current.recordAsync({
          maxDuration: totalDuration,
        });

        if (result?.uri) {
          setLocalVideoUri(result.uri);
        }
      } catch (error) {
        console.error('Erro ao iniciar gravação:', error);
      }
    };

    startRecording();

    const pulseRing = (
      scaleAnim: Animated.Value,
      opacityAnim: Animated.Value,
      delay: number,
      maxScale: number,
    ) => {
      const loop = () => {
        scaleAnim.setValue(1);
        opacityAnim.setValue(0.7);

        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: maxScale,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => setTimeout(loop, delay));
      };

      setTimeout(loop, delay);
    };

    pulseRing(ring1Scale, ring1Opacity, 0, 1.5);
    pulseRing(ring2Scale, ring2Opacity, 400, 1.8);
    pulseRing(ring3Scale, ring3Opacity, 800, 2.1);

    Animated.loop(
      Animated.sequence([
        Animated.timing(recDotOpacity, {
          toValue: 0.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(recDotOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: totalDuration * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(progressGlowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(progressGlowAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const interval = setInterval(async () => {
      await haptic(Haptics.ImpactFeedbackStyle.Light);

      setElapsed(prev => {
        const next = prev + 1;

        if (next >= totalDuration) {
          clearInterval(interval);

          if (isIosSimulator) {
            setLocalVideoUri('simulator://mock-video');
          } else {
            void safeStopRecording();
          }

          return totalDuration;
        }

        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);

      if (!isIosSimulator) {
        void safeStopRecording();
      }
    };
  }, [
    haptic,
    isIosSimulator,
    phase,
    progressAnim,
    progressGlowAnim,
    recDotOpacity,
    ring1Opacity,
    ring1Scale,
    ring2Opacity,
    ring2Scale,
    ring3Opacity,
    ring3Scale,
    safeStopRecording,
    totalDuration,
  ]);

  useEffect(() => {
    if (phase !== 'recording') return;
    if (localVideoUri) {
      setPhase('done');
    }
  }, [localVideoUri, phase]);

  useEffect(() => {
    if (phase !== 'done') return;

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    Animated.spring(doneScale, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();

    const tId = setTimeout(() => {
      router.replace({
        pathname: '/processing',
        params: {
          duration: String(finalDuration),
          effect: preset,
          eventId,
          eventName,
          eventColor,
          logoUrl: logoUrl || '',
          localVideoUri: localVideoUri || '',
          kioskMode: kioskMode || '0',
          musicSelection: musicSelection || 'auto',
          frameCloudinaryId: frameCloudinaryId || '',
        },
      });
    }, 900);

    return () => clearTimeout(tId);
  }, [
    doneScale,
    eventColor,
    eventId,
    eventName,
    finalDuration,
    frameCloudinaryId,
    kioskMode,
    localVideoUri,
    logoUrl,
    musicSelection,
    phase,
    preset,
    router,
  ]);

  const toggleFacing = () => {
    haptic();
    setFacing(f => (f === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    haptic();
    setFlash(f => (f === 'off' ? 'on' : 'off'));
  };

  const handleCancel = () => {
    if (phase === 'recording' && !isIosSimulator) {
      void safeStopRecording();
    }
    router.back();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (phase === 'permissions') {
    return (
      <LinearGradient colors={['#0D0820', '#0A0F2E']} style={styles.container}>
        <View style={styles.centerBlock}>
          <MaterialIcons name="videocam" size={56} color={Colors.Primary} />
          <Text style={styles.permText}>{t.common.loading}</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: cameraOpacity }]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          flash={flash}
          mode="video"
        />
        <LinearGradient
          colors={[
            'rgba(13,8,32,0.45)',
            'rgba(13,8,32,0.1)',
            'rgba(13,8,32,0.1)',
            'rgba(13,8,32,0.65)',
          ]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {phase === 'recording' && (
        <View style={styles.recTint} pointerEvents="none" />
      )}

      {phase !== 'done' && (
        <Pressable
          style={[styles.cancelBtn, { top: insets.top + 12, left: Spacing.lg }]}
          onPress={handleCancel}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={18} color="#fff" />
        </Pressable>
      )}

      {phase !== 'done' && (
        <View style={[styles.cameraControls, { top: insets.top + 12, right: Spacing.lg }]}>
          <Pressable
            style={[styles.camBtn, flash === 'on' && styles.camBtnActive]}
            onPress={toggleFlash}
            hitSlop={8}
          >
            <MaterialIcons
              name={flash === 'on' ? 'flash-on' : 'flash-off'}
              size={18}
              color={flash === 'on' ? '#FBBF24' : '#fff'}
            />
          </Pressable>

          <Pressable
            style={[styles.camBtn, phase === 'recording' && styles.camBtnDisabled]}
            onPress={phase !== 'recording' ? toggleFacing : undefined}
            hitSlop={8}
          >
            <MaterialIcons
              name="flip-camera-ios"
              size={18}
              color={phase === 'recording' ? 'rgba(255,255,255,0.35)' : '#fff'}
            />
          </Pressable>
        </View>
      )}

      <View style={[styles.eventBadge, { top: insets.top + 14 }]}>
        <View style={[styles.eventDot, { backgroundColor: eventColor || Colors.Primary }]} />
        <Text style={styles.eventText} numberOfLines={1}>
          {eventName}
        </Text>
      </View>

      {phase === 'countdown' && (
        <View style={styles.centerBlock}>
          <Text style={styles.prepareText}>{t.recording.getReady}</Text>

          <Animated.Text
            style={[
              styles.countNum,
              { transform: [{ scale: countScale }], opacity: countOpacity },
            ]}
          >
            {countdown}
          </Animated.Text>

          <Text style={styles.countSub}>{t.recording.recording}...</Text>
          <Text style={styles.microLabel}>{recordingHint}</Text>
        </View>
      )}

      {phase === 'recording' && (
        <View style={styles.centerBlock}>
          <View style={styles.orbStage}>
            <View style={styles.orbAnchor} pointerEvents="none">
              <Animated.View
                style={[
                  styles.ring,
                  styles.ringBase,
                  { transform: [{ scale: ring3Scale }], opacity: ring3Opacity },
                ]}
              />
              <Animated.View
                style={[
                  styles.ring,
                  styles.ringBase,
                  { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
                ]}
              />
              <Animated.View
                style={[
                  styles.ring,
                  styles.ringBase,
                  { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
                ]}
              />

              <View style={styles.recOrb}>
                <Animated.View style={[styles.recDot, { opacity: recDotOpacity }]} />
                <Text style={styles.recLabel}>REC</Text>
              </View>
            </View>
          </View>

          <View style={styles.timeBlock}>
            <Text style={styles.timeElapsed}>{displayedElapsed}</Text>
            <Text style={styles.timeSep}>/</Text>
            <Text style={styles.timeTotal}>{finalDuration}s</Text>
          </View>

          <Text style={styles.remainText}>{remaining}s</Text>
          <Text style={styles.microLabel}>{recordingHint}</Text>

          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <Animated.View style={[styles.progressGlow, { opacity: progressGlowAnim }]} />
              </Animated.View>
            </View>
          </View>
        </View>
      )}

      {phase === 'done' && (
        <View style={[StyleSheet.absoluteFillObject, styles.doneOverlay]}>
          <Animated.View
            style={[styles.centerBlock, { transform: [{ scale: doneScale }] }]}
          >
            <View style={styles.doneOrb}>
              <MaterialIcons name="check" size={64} color={Colors.Success} />
            </View>
            <Text style={styles.doneTitle}>{t.common.success}!</Text>
            <Text style={styles.doneSub}>{t.processing.title}...</Text>
          </Animated.View>
        </View>
      )}

      {phase !== 'done' && (
        <View style={[styles.bottomBadge, { bottom: insets.bottom + 36 }]}>
          <Text style={styles.effectText}>
            {presetConfig.emoji} {presetConfig.label}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0820',
  },

  recTint: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 0,
    zIndex: 1,
    pointerEvents: 'none',
  } as any,

  cancelBtn: {
    position: 'absolute',
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  cameraControls: {
    position: 'absolute',
    zIndex: 20,
    flexDirection: 'column',
    gap: 8,
  },

  camBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  camBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderColor: '#FBBF2488',
  },

  camBtnDisabled: { opacity: 0.4 },

  eventBadge: {
    position: 'absolute',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  eventText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    maxWidth: 200,
  },

  centerBlock: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    zIndex: 10,
  },

  permText: {
    color: Colors.TextSubtle,
    fontSize: FontSize.md,
    marginTop: Spacing.md,
  },

  prepareText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: FontWeight.medium,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  countNum: {
    fontSize: 148,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    lineHeight: 160,
    marginVertical: -8,
    textShadowColor: '#8B5CF6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },

  countSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  microLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },

  orbStage: {
    width: ORB_STAGE_SIZE,
    height: ORB_STAGE_SIZE,
    position: 'relative',
  },

  orbAnchor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
  },

  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: Colors.Recording,
  },

  ringBase: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    marginLeft: -(RING_SIZE / 2),
    marginTop: -(RING_SIZE / 2),
  },

  recOrb: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    marginLeft: -(ORB_SIZE / 2),
    marginTop: -(ORB_SIZE / 2),
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    borderColor: Colors.Recording + 'AA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  recDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.Recording,
  },

  recLabel: {
    color: Colors.Recording,
    fontSize: 11,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 4,
    marginTop: 2,
  },

  timeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },

  timeElapsed: {
    fontSize: 72,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    lineHeight: 80,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  timeSep: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 56,
    fontWeight: FontWeight.regular,
  },

  timeTotal: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 56,
    fontWeight: FontWeight.regular,
  },

  remainText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
    marginTop: -Spacing.sm,
  },

  progressWrap: { width: 280 },

  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },

  progressFill: {
    height: '100%',
    backgroundColor: Colors.Recording,
    borderRadius: 4,
    position: 'relative',
    overflow: 'visible',
  },

  progressGlow: {
    position: 'absolute',
    right: 0,
    top: -4,
    width: 20,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.Recording,
    shadowColor: Colors.Recording,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },

  doneOverlay: {
    backgroundColor: 'rgba(13,8,32,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },

  doneOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.Success + '18',
    borderWidth: 2,
    borderColor: Colors.Success + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },

  doneTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.Success,
  },

  doneSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
  },

  bottomBadge: {
    position: 'absolute',
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  effectText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.xs,
  },
});