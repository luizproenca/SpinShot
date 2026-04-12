import React from 'react';
import {
  Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  colors?: string[];
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  variant?: 'gradient' | 'outline' | 'ghost';
}

export function GradientButton({
  title,
  onPress,
  colors = Colors.GradientBrand,
  disabled = false,
  loading = false,
  size = 'lg',
  style,
  textStyle,
  icon,
  variant = 'gradient',
}: GradientButtonProps) {
  const heights = { sm: 40, md: 48, lg: 56, xl: 72 };
  const fontSizes = { sm: FontSize.sm, md: FontSize.md, lg: FontSize.lg, xl: FontSize.xl };

  if (variant === 'outline') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.outline,
          { height: heights[size], opacity: pressed ? 0.7 : 1 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.Primary} />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text style={[styles.outlineText, { fontSize: fontSizes[size] }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.ghost,
          { height: heights[size], opacity: pressed ? 0.6 : 1 },
          style,
        ]}
      >
        <View style={styles.row}>
          {icon}
          <Text style={[styles.ghostText, { fontSize: fontSizes[size] }, textStyle]}>
            {title}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.wrapper,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        !disabled && Shadow.glow,
        style,
      ]}
    >
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, { height: heights[size] }]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text style={[styles.text, { fontSize: fontSizes[size] }, textStyle]}>
              {title}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
  },
  text: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  outline: {
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.Primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  outlineText: {
    color: Colors.Primary,
    fontWeight: FontWeight.semibold,
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  ghostText: {
    color: Colors.TextSecondary,
    fontWeight: FontWeight.medium,
  },
});
