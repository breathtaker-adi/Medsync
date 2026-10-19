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
          <Text style={[styles.brandTitleHorizontalText, isLight && styles.textLight]}>
            <Text style={styles.medColor}>Med</Text>
            <Text style={isLight ? styles.textLightSync : styles.syncColor}>Sync</Text>
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
      <View style={styles.brandTitleStackedRow}>
        <Text style={[styles.brandTitleText, isLight && styles.textLight]}>
          <Text style={styles.medColor}>Med</Text>
          <Text style={isLight ? styles.textLightSync : styles.syncColor}>Sync</Text>
        </Text>
      </View>
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
  brandTitleHorizontalText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    includeFontPadding: false,
  },
  brandTitleStackedRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  brandTitleText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    textAlign: 'center',
    includeFontPadding: false,
  },
  medColor: {
    color: Theme.colors.primary,
  },
  syncColor: {
    color: '#0F172A',
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
