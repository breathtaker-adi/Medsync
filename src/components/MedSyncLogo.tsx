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
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { Theme } from '../theme';

export interface MedSyncLogoProps {
  size?: number;
  variant?: 'icon-only' | 'horizontal' | 'stacked' | 'badge';
  animated?: boolean;
  colorScheme?: 'teal' | 'white' | 'dark';
  style?: ViewStyle;
}

/**
 * MedSyncLogo: High-fidelity vectorized representation of the MedSync emblem.
 * Features:
 *  1. Background Clock Face (circular dial with hour marks & hands at ~1:50)
 *  2. 3D Slanted Medical Capsule (glossy dual-tone teal & cyan pill with specular shine)
 *  3. Dynamic 3D Orbital Sync Ring (wrapping behind and across the waist of the capsule)
 *  4. Support for 'icon-only', 'horizontal', 'stacked', and 'badge' layouts.
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

  const renderVectorEmblem = () => (
    <Animated.View
      style={[{ width: size, height: size }, animated ? animatedStyle : undefined]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
      >
        <Defs>
          {/* Clock Outline Gradient */}
          <LinearGradient id="clockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={isLight ? '#E0F2FE' : '#0D7377'} stopOpacity={isLight ? '0.7' : '0.55'} />
            <Stop offset="100%" stopColor={isLight ? '#38BDF8' : '#14B8A6'} stopOpacity={isLight ? '0.5' : '0.4'} />
          </LinearGradient>

          {/* Capsule Top (Deep Glossy Teal/Blue) */}
          <LinearGradient id="capsuleTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={isLight ? '#38BDF8' : '#0284C7'} />
            <Stop offset="60%" stopColor={isLight ? '#0284C7' : '#0D7377'} />
            <Stop offset="100%" stopColor={isLight ? '#0D7377' : '#00595C'} />
          </LinearGradient>

          {/* Capsule Bottom (Translucent Mint/Cyan) */}
          <LinearGradient id="capsuleBottom" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={isLight ? '#5EEAD4' : '#14B8A6'} />
            <Stop offset="100%" stopColor={isLight ? '#2DD4BF' : '#4ECCA3'} />
          </LinearGradient>

          {/* Orbit Back Half Gradient */}
          <LinearGradient id="orbitBackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0D7377" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#22D3EE" stopOpacity="0.5" />
          </LinearGradient>

          {/* Orbit Front Half Gradient (Bright Glowing Swoosh) */}
          <LinearGradient id="orbitFrontGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#14B8A6" stopOpacity="0.95" />
            <Stop offset="60%" stopColor="#22D3EE" stopOpacity="1" />
            <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0.9" />
          </LinearGradient>

          {/* Specular White Highlight */}
          <LinearGradient id="shineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
          </LinearGradient>
        </Defs>

        {/* 1. CLOCK FACE BACKGROUND */}
        <Circle
          cx="68"
          cy="46"
          r="36"
          stroke="url(#clockGrad)"
          strokeWidth="3.2"
          fill="none"
        />

        {/* Clock 12, 3, 6, 9 Ticks */}
        <Line x1="68" y1="13" x2="68" y2="19" stroke="url(#clockGrad)" strokeWidth="3" strokeLinecap="round" />
        <Line x1="101" y1="46" x2="95" y2="46" stroke="url(#clockGrad)" strokeWidth="3" strokeLinecap="round" />
        <Line x1="68" y1="79" x2="68" y2="73" stroke="url(#clockGrad)" strokeWidth="3" strokeLinecap="round" />
        <Line x1="35" y1="46" x2="41" y2="46" stroke="url(#clockGrad)" strokeWidth="3" strokeLinecap="round" />

        {/* Clock Hands (Pointing at ~1:50) */}
        <Line
          x1="68"
          y1="46"
          x2="85"
          y2="33"
          stroke={isLight ? '#FFFFFF' : '#0D7377'}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <Line
          x1="68"
          y1="46"
          x2="53"
          y2="28"
          stroke={isLight ? '#FFFFFF' : '#0D7377'}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <Circle cx="68" cy="46" r="3.8" fill={isLight ? '#FFFFFF' : '#0D7377'} />

        {/* 2. BACK HALF OF ORBITAL RING (Passes behind capsule) */}
        <Path
          d="M 22,66 C 26,46 54,34 84,46 C 96,51 102,60 98,69"
          stroke="url(#orbitBackGrad)"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* 3. 3D ANGLED MEDICAL CAPSULE (Slanted ~ -34 degrees) */}
        <G transform="rotate(-34, 52, 58)">
          {/* Top Half of Capsule */}
          <Path
            d="M 39,46 C 39,34.95 44.82,26 52,26 C 59.18,26 65,34.95 65,46 L 65,58 L 39,58 Z"
            fill="url(#capsuleTop)"
          />

          {/* Bottom Half of Capsule */}
          <Path
            d="M 39,58 L 65,58 L 65,70 C 65,81.05 59.18,90 52,90 C 44.82,90 39,81.05 39,70 Z"
            fill="url(#capsuleBottom)"
          />

          {/* Center Seam / Divider */}
          <Line
            x1="39"
            y1="58"
            x2="65"
            y2="58"
            stroke="#003B3E"
            strokeWidth="1.2"
            strokeOpacity="0.35"
          />

          {/* Glossy Edge Reflection / Shine */}
          <Path
            d="M 43,34 C 41,44 41,70 43,82"
            stroke="url(#shineGrad)"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />

          {/* Top Shoulder Gloss Spot */}
          <Circle cx="48" cy="32" r="2.2" fill="#FFFFFF" fillOpacity="0.75" />
        </G>

        {/* 4. FRONT HALF OF ORBITAL RING (Sweeps in front of capsule) */}
        <Path
          d="M 19,67 C 15,56 28,76 54,80 C 78,84 102,74 97,62"
          stroke="url(#orbitFrontGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Glowing Head Point of Orbit */}
        <Circle cx="97" cy="62" r="3.2" fill="#38BDF8" />
        <Circle cx="97" cy="62" r="1.5" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );

  if (variant === 'icon-only') {
    return <View style={style}>{renderVectorEmblem()}</View>;
  }

  if (variant === 'badge') {
    return (
      <View style={[styles.badgeContainer, style]}>
        {renderVectorEmblem()}
      </View>
    );
  }

  if (variant === 'horizontal') {
    return (
      <View style={[styles.horizontalContainer, style]}>
        {renderVectorEmblem()}
        <View style={styles.horizontalTextContainer}>
          <View style={styles.brandTitleRow}>
            <Text style={[styles.medText, isLight && styles.textLight]}>Med</Text>
            <Text style={[styles.syncText, isLight && styles.textLightSync]}>Sync</Text>
          </View>
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
      {renderVectorEmblem()}
      <View style={styles.brandTitleRow}>
        <Text style={[styles.medTextStacked, isLight && styles.textLight]}>Med</Text>
        <Text style={[styles.syncTextStacked, isLight && styles.textLightSync]}>Sync</Text>
      </View>
      <Text style={[styles.subTextStacked, isLight && styles.subTextLight]}>
        DAILY MEDICATION COMPANION
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    ...Theme.shadows.card,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  medText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: Theme.colors.primary,
    letterSpacing: -0.5,
  },
  syncText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  subText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  stackedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTextStacked: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.primary,
    letterSpacing: -0.8,
    marginTop: 12,
  },
  syncTextStacked: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: '#1E293B',
    letterSpacing: -0.8,
    marginTop: 12,
  },
  subTextStacked: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 1.4,
    marginTop: 4,
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
