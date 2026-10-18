// src/components/MedSyncLogo.tsx
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Theme } from '../theme';

const LOGO_SOURCE = require('../../assets/images/logo-transparent.png');

export interface MedSyncLogoProps {
  size?: number;
  variant?: 'icon-only' | 'horizontal' | 'stacked' | 'badge';
  animated?: boolean;
  colorScheme?: 'teal' | 'white' | 'dark';
  style?: ViewStyle;
}

/**
 * MedSyncLogo: Renders the authentic MedSync brand emblem from assets/images/logo-transparent.png
 * without any white background or artificial vector deviations.
 * Uses unified nested Text elements to prevent kerning clipping where 'd' might be truncated.
 */
export const MedSyncLogo: React.FC<MedSyncLogoProps> = ({
  size = 56,
  variant = 'icon-only',
  animated = false,
  colorScheme = 'teal',
  style,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isLight = colorScheme === 'white';

  const renderEmblem = () => (
    <Animated.View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        animated ? animatedStyle : undefined,
      ]}
    >
      <Image
        source={LOGO_SOURCE}
        style={{ width: size, height: size }}
        contentFit="contain"
        priority="high"
      />
    </Animated.View>
  );

  if (variant === 'icon-only') {
    return <View style={style}>{renderEmblem()}</View>;
  }

  if (variant === 'badge') {
    return (
      <View style={[styles.badgeContainer, style]}>
        {renderEmblem()}
      </View>
    );
  }

  if (variant === 'horizontal') {
    return (
      <View style={[styles.horizontalContainer, style]}>
        {renderEmblem()}
        <View style={styles.horizontalTextContainer}>
          <Text style={styles.brandTitleRow}>
            <Text style={[styles.medText, isLight && styles.textLight]}>Med</Text>
            <Text style={[styles.syncText, isLight && styles.textLightSync]}>Sync{'\u200A'}</Text>
          </Text>
          <Text style={[styles.subText, isLight && styles.subTextLight]}>
            DAILY HEALTH COMPANION
          </Text>
        </View>
      </View>
    );
  }

  // Default: 'stacked'
  return (
    <View style={[styles.stackedContainer, style]}>
      {renderEmblem()}
      <Text style={styles.brandTitleStacked}>
        <Text style={[styles.medTextStacked, isLight && styles.textLight]}>Med</Text>
        <Text style={[styles.syncTextStacked, isLight && styles.textLightSync]}>Sync{'\u200A'}</Text>
      </Text>
      <Text style={[styles.subTextStacked, isLight && styles.subTextLight]}>
        DAILY MEDICATION COMPANION
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  horizontalTextContainer: {
    justifyContent: 'center',
  },
  brandTitleRow: {
    fontSize: 24,
    lineHeight: 30,
    includeFontPadding: false,
    paddingRight: 6,
  },
  brandTitleStacked: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
    includeFontPadding: false,
  },
  medText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: Theme.colors.primary,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  syncText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: '#1E293B',
    letterSpacing: -0.2,
    includeFontPadding: false,
    paddingRight: 4,
  },
  subText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 1.0,
    marginTop: 2,
    includeFontPadding: false,
  },
  stackedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  medTextStacked: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.primary,
    includeFontPadding: false,
  },
  syncTextStacked: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: '#1E293B',
    includeFontPadding: false,
    paddingRight: 6,
  },
  subTextStacked: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.8,
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  textLight: {
    color: '#FFFFFF',
  },
  textLightSync: {
    color: '#E0F2FE',
  },
  subTextLight: {
    color: '#94A3B8',
  },
});
