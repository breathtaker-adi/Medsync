import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Theme } from '../theme';
import { MedSyncLogo } from './MedSyncLogo';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onFinish?: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  isReady,
  onFinish,
}) => {
  const opacity = useSharedValue(1);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (isReady) {
      // Hold for a pleasant 1.2s so the user can enjoy the heart pulse animation, then fade out smoothly
      opacity.value = withDelay(
        1200,
        withTiming(0, { duration: 500 }, (finished) => {
          if (finished) {
            runOnJS(setVisible)(false);
            if (onFinish) {
              runOnJS(onFinish)();
            }
          }
        })
      );
    }
  }, [isReady]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Background Soft Glow */}
      <View style={styles.topSection}>
        {/* Vectorized MedSync Emblem + Typography */}
        <MedSyncLogo size={90} variant="stacked" animated={true} />
      </View>

      {/* Bottom Section: Love Heart UiUx Animation & Tagline */}
      <View style={styles.bottomSection}>
        <View style={styles.heartAnimationWrapper}>
          <Image
            source={require('../../assets/images/heart-animation.webp')}
            style={styles.heartAnimation}
            contentFit="contain"
            priority="high"
          />
        </View>
        <Text style={styles.heartTagline}>Care • Timing • Peace of Mind</Text>
      </View>
    </Animated.View>
  );
};
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: height * 0.12,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heartAnimationWrapper: {
    width: 140,
    height: 106,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heartAnimation: {
    width: '100%',
    height: '100%',
  },
  heartTagline: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
