import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface PulseViewProps {
  children: React.ReactNode;
  active?: boolean;
  style?: ViewStyle;
  minScale?: number;
  maxScale?: number;
  duration?: number;
}

export const PulseView: React.FC<PulseViewProps> = ({
  children,
  active = true,
  style,
  minScale = 0.98,
  maxScale = 1.02,
  duration = 1600,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(maxScale, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(minScale, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [active, minScale, maxScale, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, active ? animatedStyle : undefined]}>
      {children}
    </Animated.View>
  );
};
