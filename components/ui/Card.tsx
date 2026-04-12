import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glow?: boolean;
  glowColor?: string;
}

export function Card({ children, style, glow = false, glowColor = Colors.Primary }: CardProps) {
  return (
    <View style={[
      styles.card,
      glow && { ...Shadow.glow, shadowColor: glowColor },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.Surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.Border,
    overflow: 'hidden',
  },
});
