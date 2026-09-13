// src/context/AccessibilityContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AccessibilityContextType = {
  isAccessibilityMode: boolean;
  isAudioEnabled: boolean;
  toggleAccessibility: () => void;
  toggleAudio: () => void;
  triggerHaptic: (style?: Haptics.ImpactFeedbackStyle) => void;
};

const AccessibilityContext = createContext<AccessibilityContextType>({
  isAccessibilityMode: false,
  isAudioEnabled: false,
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
    await AsyncStorage.setItem('accessMode', newValue.toString());
  };

  const toggleAudio = async () => {
    const newValue = !isAudioEnabled;
    setIsAudioEnabled(newValue);
    await AsyncStorage.setItem('audioMode', newValue.toString());
  };

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (isAccessibilityMode) {
      Haptics.impactAsync(style);
    }
  };

  return (
    <AccessibilityContext.Provider 
      value={{ isAccessibilityMode, isAudioEnabled, toggleAccessibility, toggleAudio, triggerHaptic }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);