import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import QRCode from 'react-native-qrcode-svg';
import { MaterialIcons } from '@expo/vector-icons';

type RecordingStatus =
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'finished'
  | 'cancelled'
  | 'ready';

type RecordingState = {
  event_id: string;
  event_name: string | null;
  event_color: string | null;
  status: RecordingStatus;
  countdown: number;
  remaining_seconds: number;
  video_url?: string;
};

export default function OperatorScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<RecordingState | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`recording_state_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recording_state',
          filter: `event_id=eq.${String(eventId)}`,
        },
        payload => {
          if (payload.new) {
            setState(payload.new as RecordingState);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const status = state?.status ?? 'idle';
  const color = state?.event_color || '#8B5CF6';

  const renderContent = () => {
    if (status === 'countdown') {
      return (
        <>
          <Text style={[styles.title, { color }]}>PREPARE-SE</Text>
          <Text style={styles.value}>{state?.countdown}</Text>
        </>
      );
    }

    if (status === 'recording') {
      return (
        <>
          <Text style={[styles.title, { color }]}>GRAVANDO</Text>
          <Text style={styles.value}>{state?.remaining_seconds}</Text>
          <Text style={styles.subtitle}>segundos restantes</Text>
        </>
      );
    }

    if (status === 'finished') {
      return (
        <>
          <Text style={[styles.title, { color }]}>FINALIZADO</Text>
          <Text style={styles.subtitle}>Processando vídeo...</Text>
        </>
      );
    }

    if (status === 'ready' && state?.video_url) {
      return (
        <>
          <Text style={[styles.title, { color }]}>SEU VÍDEO ESTÁ PRONTO</Text>

          <View style={styles.qrBox}>
            <QRCode value={state.video_url} size={220} />
          </View>

          <Text style={styles.subtitle}>Escaneie para baixar</Text>
        </>
      );
    }

    return (
      <>
        <Text style={[styles.title, { color }]}>PRONTO</Text>
        <Text style={styles.subtitle}>Aguardando gravação</Text>
      </>
    );
  };

  return (
    <LinearGradient colors={['#0D0820', '#12073A', '#0A0F2E']} style={styles.container}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { top: insets.top + 12 }]}
          hitSlop={10}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>

        <View style={styles.stage}>
          {renderContent()}
        </View>

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },

  back: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: 10,
  },

  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },

  title: {
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
  },

  value: {
    fontSize: 160,
    fontWeight: '900',
    color: '#fff',
  },

  subtitle: {
    fontSize: 26,
    color: '#fff',
  },

  qrBox: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  backBtn: {
  position: 'absolute',
  left: 20,
  zIndex: 50,
  width: 46,
  height: 46,
  borderRadius: 23,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.45)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.18)',
},
});