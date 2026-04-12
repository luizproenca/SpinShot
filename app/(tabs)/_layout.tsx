import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useLanguage } from '../../hooks/useLanguage';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
          paddingHorizontal: 16,
          backgroundColor: '#0D0A20',
          borderTopWidth: 1,
          borderTopColor: Colors.Border,
        },
        tabBarActiveTintColor: Colors.Primary,
        tabBarInactiveTintColor: Colors.TextMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.capture,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="videocam" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t.tabs.events,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="celebration" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: t.tabs.videos,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="video-library" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="frames"
        options={{
          title: t.tabs.frames,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabs.settings,
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
