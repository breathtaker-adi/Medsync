// App.js
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Theme } from './src/theme';

// Keep the splash screen visible while we fetch fonts
SplashScreen.preventAutoHideAsync();

// Import our Navigation setup (we will create this file next)
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  // Load the fonts
  const [fontsLoaded] = useFonts({
    'PublicSans-Regular': require('./assets/fonts/PublicSans-Regular.ttf'),
    'PublicSans-Medium': require('./assets/fonts/PublicSans-Medium.ttf'),
    'PublicSans-Bold': require('./assets/fonts/PublicSans-Bold.ttf'),
    'PublicSans-ExtraBold': require('./assets/fonts/PublicSans-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Hide the splash screen once fonts are loaded
      SplashScreen.hideAsync();
      setAppIsReady(true);
    }
  }, [fontsLoaded]);

  if (!appIsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.surface }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}