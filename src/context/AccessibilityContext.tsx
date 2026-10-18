// src/context/AccessibilityContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type AccessibilityThemeContrast = {
  text: string;
  subText: string;
  border: string;
  cardBorderWidth: number;
};

type AccessibilityContextType = {
  isAccessibilityMode: boolean;
  isAudioEnabled: boolean;
  fontSizeMultiplier: number;
  fontScale: (baseSize: number) => number;
  contrast: AccessibilityThemeContrast;
  toggleAccessibility: () => void;
  toggleAudio: () => void;
  triggerHaptic: (style?: Haptics.ImpactFeedbackStyle) => void;
};

const defaultContrast: AccessibilityThemeContrast = {
  text: '#0F172A',
  subText: '#64748B',
  border: '#E2E8F0',
  cardBorderWidth: 1,
};

const highContrast: AccessibilityThemeContrast = {
  text: '#000000',
  subText: '#0F172A',
  border: '#000000',
  cardBorderWidth: 2,
};

const AccessibilityContext = createContext<AccessibilityContextType>({
  isAccessibilityMode: false,
  isAudioEnabled: false,
  fontSizeMultiplier: 1.0,
  fontScale: (baseSize: number) => baseSize,
  contrast: defaultContrast,
  toggleAccessibility: () => {},
  toggleAudio: () => {},
  triggerHaptic: () => {},
});

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Load preferences from AsyncStorage on startup
  useEffect(() => {
    (async () => {
      const accessMode = await AsyncStorage.getItem('accessMode');
      const audioMode = await AsyncStorage.getItem('audioMode');
      if (accessMode === 'true') setIsAccessibilityMode(true);
      if (audioMode === 'true') setIsAudioEnabled(true);
    })();
  }, []);

  const toggleAccessibility = async () => {
    const newValue = !isAccessibilityMode;
    setIsAccessibilityMode(newValue);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem('accessMode', newValue.toString());
  };

  const toggleAudio = async () => {
    const newValue = !isAudioEnabled;
    setIsAudioEnabled(newValue);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem('audioMode', newValue.toString());
  };

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (isAccessibilityMode) {
      Haptics.impactAsync(style);
    }
  };

  const fontSizeMultiplier = isAccessibilityMode ? 1.2 : 1.0;
  const fontScale = (baseSize: number) => Math.round(baseSize * fontSizeMultiplier);
  const contrast = isAccessibilityMode ? highContrast : defaultContrast;

  return (
    <AccessibilityContext.Provider
      value={{
        isAccessibilityMode,
        isAudioEnabled,
        fontSizeMultiplier,
        fontScale,
        contrast,
        toggleAccessibility,
        toggleAudio,
        triggerHaptic,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);