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
          <Text
            style={{
              includeFontPadding: false,
            }}
            numberOfLines={1}
          >
            <Text style={[styles.medText, isLight && styles.textLight]}>Med</Text>
            <Text style={[styles.syncText, isLight && styles.textLightSync]}>Sync</Text>
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
      <Text
        style={{
          width: '100%',
          textAlign: 'center',
          includeFontPadding: false,
          marginTop: 8,
        }}
        numberOfLines={1}
      >
        <Text style={[styles.medTextStacked, isLight && styles.textLight]}>Med</Text>
        <Text style={[styles.syncTextStacked, isLight && styles.textLightSync]}>Sync</Text>
      </Text>
      <Text style={[styles.subTextStacked, isLight && styles.subTextLight]}>
        DAILY MEDICATION CARE
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
  brandTitleHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleStackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  medText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: Theme.colors.primary,
    includeFontPadding: false,
  },
  syncText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: '#0F172A',
    includeFontPadding: false,
    paddingRight: 6,
  },
  subText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9.5,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 1.0,
    marginTop: 2,
    includeFontPadding: false,
  },
  stackedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
    color: '#0F172A',
    includeFontPadding: false,
    paddingRight: 6,
  },
  subTextStacked: {
    width: '100%',
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.8,
    marginTop: 3,
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
