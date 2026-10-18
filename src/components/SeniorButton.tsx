import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Pressable,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Theme } from '../theme';

interface SeniorButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'outline';
  size?: 'normal' | 'large';
  icon?: React.ReactNode | keyof typeof Ionicons.glyphMap | string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

export const SeniorButton: React.FC<SeniorButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'normal',
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
  hapticStyle = Haptics.ImpactFeedbackStyle.Medium,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.96, { damping: 12, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    try {
      Haptics.impactAsync(hapticStyle);
    } catch {
      // Haptics fail gracefully on unsupported simulators
    }
    onPress();
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: Theme.colors.success,
          borderColor: Theme.colors.success,
        };
      case 'secondary':
        return {
          backgroundColor: Theme.colors.primarySoft,
          borderColor: Theme.colors.primarySoft,
        };
      case 'danger':
        return {
          backgroundColor: Theme.colors.error,
          borderColor: Theme.colors.error,
        };
      case 'outline':
        return {
          backgroundColor: '#FFFFFF',
          borderColor: Theme.colors.primary,
          borderWidth: 2,
        };
      case 'primary':
      default:
        return {
          backgroundColor: Theme.colors.primary,
          borderColor: Theme.colors.primary,
        };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'outline':
        return Theme.colors.primary;
      case 'secondary':
        return Theme.colors.primary;
      default:
        return '#FFFFFF';
    }
  };

  const height = size === 'large' ? 50 : Theme.spacing.touchTargetSenior;

  return (
    <Animated.View style={[animatedStyle, { width: '100%' }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[
          styles.baseButton,
          getVariantStyle(),
          { height, minHeight: height },
          variant !== 'outline' && Theme.shadows.button,
          disabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <View style={styles.contentRow}>
            {icon && (
              <View style={styles.iconWrapper}>
                {typeof icon === 'string' ? (
                  <Ionicons name={icon as any} size={18} color={getTextColor()} />
                ) : (
                  icon
                )}
              </View>
            )}
            <Text
              numberOfLines={1}
              style={[
                styles.text,
                size === 'large' ? styles.textLarge : styles.textNormal,
                { color: getTextColor() },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    borderRadius: Theme.rounded.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  iconWrapper: {
    marginRight: 8,
    flexShrink: 0,
  },
  text: {
    fontFamily: 'PublicSans-Bold',
    letterSpacing: 0.1,
    textAlignVertical: 'center',
    paddingHorizontal: 2,
  },
  textNormal: {
    fontSize: 14.5,
  },
  textLarge: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});
