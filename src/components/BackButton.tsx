import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Theme } from '../theme';

export interface BackButtonProps {
  onPress?: () => void;
  fallbackRoute?: string;
  size?: 'normal' | 'large';
  variant?: 'standard' | 'plain' | 'filled';
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  accessibilityLabel?: string;
}

export function BackButton({
  onPress,
  fallbackRoute = '/(tabs)',
  size = 'normal',
  variant = 'standard',
  style,
  iconColor = Theme.colors.onSurface,
  accessibilityLabel = 'Go back',
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (onPress) {
      onPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }
  };

  const isLarge = size === 'large';
  const iconSize = isLarge ? 22 : 18;

  const getVariantStyle = () => {
    switch (variant) {
      case 'filled':
        return styles.filled;
      case 'plain':
        return styles.plain;
      case 'standard':
      default:
        return styles.standard;
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        isLarge ? styles.large : styles.normal,
        getVariantStyle(),
        style,
      ]}
    >
      <Ionicons name="arrow-back" size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  normal: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  large: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  standard: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filled: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.level1,
  },
  plain: {
    backgroundColor: 'transparent',
  },
});

export default BackButton;
