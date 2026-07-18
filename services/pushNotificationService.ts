import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getSupabaseClient } from '@/template';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const supabase = getSupabaseClient();

/**
 * Requests notification permission and registers this device's Expo push
 * token against the logged-in user. Safe to call repeatedly (e.g. on every
 * app start / login) — it's a plain upsert keyed by token.
 *
 * No-ops on web and on physical-device-less environments (simulators don't
 * support real push tokens).
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[push] permission not granted, skipping token registration');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[push] missing eas.projectId, cannot get Expo push token');
      return;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      );

    if (error) {
      console.warn('[push] failed to save push token:', error.message);
    } else {
      console.log('[push] token registered');
    }
  } catch (err) {
    console.warn('[push] registration failed:', err);
  }
}

/** Removes this device's push token on logout, e.g. to stop notifications meant for the previous account. */
export async function unregisterCurrentDevicePushToken(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', tokenResponse.data);
  } catch {
    // best-effort cleanup, never block logout on this
  }
}
