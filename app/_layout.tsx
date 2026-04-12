import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { AuthProvider } from '../contexts/AuthContext';
import { EventProvider } from '../contexts/EventContext';
import { FrameProvider } from '../contexts/FrameContext';
import { VideoProvider } from '../contexts/VideoContext';
import { PlanProvider } from '../contexts/PlanContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import PaywallModal from '../components/feature/PaywallModal';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <LanguageProvider>
        <PlanProvider>
          <AuthProvider>
            <EventProvider>
              <FrameProvider>
              <VideoProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="(auth)/login" />
                  <Stack.Screen name="(auth)/register" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="recording" />
                  <Stack.Screen name="processing" />
                  <Stack.Screen name="preview" />
                  <Stack.Screen name="share" />
                  <Stack.Screen name="analytics" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="create-event" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="add-frame" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="subscription" options={{ headerShown: false }} />
                </Stack>
                <PaywallModal />
              </VideoProvider>
              </FrameProvider>
            </EventProvider>
          </AuthProvider>
        </PlanProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
