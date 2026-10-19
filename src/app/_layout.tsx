// src/app/_layout.tsx
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityProvider } from '../context/AccessibilityContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { supabase } from '../lib/supabase';
import { medicationService } from '../services/medicationService';
import { Theme } from '../theme';

LogBox.ignoreLogs([
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'expo-notifications: Android Push notifications',
  'Push notifications (remote notifications) are unavailable in Expo Go',
  'ExpoNotificationChannelManager.setNotificationChannelAsync',
  'NotificationsChannelsProvider',
  'null cannot be cast to non-null type expo.modules.notifications',
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isReady = fontsLoaded && !loading;

  // Hide native OS splash screen once fonts load to transition into AnimatedSplashScreen
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Handle Notification Action Buttons (Mark Taken / Snooze)
  useEffect(() => {
    // 1. Register notification category with action buttons
    const actions: Notifications.NotificationAction[] = [
      {
        identifier: 'MARK_TAKEN',
        buttonTitle: 'I Took It',
        options: {
          opensAppToForeground: false, // Keeps app in background
          isAuthenticationRequired: true, // Requires device unlock before logging intake
        },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Snooze 20m',
        options: { opensAppToForeground: false },
      },
    ];

    try {
      Notifications.setNotificationCategoryAsync('medication-alerts', actions).catch(() => {});
    } catch {}

    // 2. Listen for notification button interactions
    let subscription: Notifications.Subscription | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(
        async (response) => {
        const actionId = response.actionIdentifier;
        const medId = response.notification.request.content.data?.medicationId;

        if (!medId) return;

        // --- ACTION 1: User tapped "I Took It" ---
        if (actionId === 'MARK_TAKEN') {
          // Get active user session
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          if (!currentSession?.user?.id) return;

          // Record dose intake atomically with inventory update via service
          await medicationService.recordDoseWithInventory({
            medicationId: Number(medId),
            patientId: currentSession.user.id,
            scheduledTime: '00:00',
          });

          // Dismiss notification banner
          await Notifications.dismissNotificationAsync(
            response.notification.request.identifier
          );
        }
        // --- ACTION 2: User tapped "Snooze 20m" ---
        else if (actionId === 'SNOOZE') {
          const snoozeDate = new Date();
          snoozeDate.setMinutes(snoozeDate.getMinutes() + 20);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🚨 SNOOZE OVER: MEDICATION ALERT',
              body: `Time to take your medication`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              categoryIdentifier: 'medication-alerts',
              data: { medicationId: medId },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: snoozeDate,
              channelId: 'medication-alarms-auto',
            },
          });

          await Notifications.dismissNotificationAsync(
            response.notification.request.identifier
          );
        }
      });
    } catch {}

    return () => {
      subscription?.remove?.();
    };
  }, []);

  // Auth routing gate
  useEffect(() => {
    if (!isReady) return;

    // Wait for profile to load before making routing decisions when session exists
    if (session && !profile) return;

    const currentRoute = segments[0] as string | undefined;
    // Routes that are strictly for unauthenticated users
    const authOnlyRoutes = ['login', 'forgot-password', 'reset-password'];
    // Routes accessible by anyone (even without logging in)
    const publicAccessibleRoutes = [...authOnlyRoutes, 'privacy-policy', 'clinical-privacy-policy'];
    const isAuthOnlyRoute = currentRoute ? authOnlyRoutes.includes(currentRoute) : false;
    const isPublicAccessibleRoute = currentRoute ? publicAccessibleRoutes.includes(currentRoute) : false;
    const inSetup = currentRoute === 'profile-setup' || currentRoute === 'role-selection';

    if (!session) {
      if (!isPublicAccessibleRoute) {
        router.replace('/login');
      }
    } else {
      // Authenticated session exists
      if (!profile || !profile.role) {
        // Incomplete profile -> direct to profile setup if not already in setup flow
        if (!inSetup) {
          router.replace('/profile-setup');
        }
      } else {
        // Role protection: Patient users cannot access clinical oversight screens
        const isCaregiverOrDoctor = profile.role === 'caregiver' || profile.role === 'doctor';

        const currentTabRoute = segments.at(1);
        const currentActiveRoute = currentTabRoute || currentRoute;
        const caregiverRestrictedRoutes = [
          'caregiver-dashboard',
          'doctor-settings',
          'patient-directory',
          'pending-reviews',
        ];

        if (!isCaregiverOrDoctor && profile.role === 'patient') {
          if (currentActiveRoute && caregiverRestrictedRoutes.includes(currentActiveRoute)) {
            router.replace('/(tabs)/patient-dashboard');
            return;
          }
        }

        // Profile exists and has a configured role: redirect away ONLY from auth-only routes (login, forgot-password)
        if (isAuthOnlyRoute) {
          if (['caregiver', 'doctor'].includes(profile.role)) {
            router.replace('/(tabs)/caregiver-dashboard');
          } else {
            router.replace('/(tabs)/patient-dashboard');
          }
        }
      }
    }
  }, [isReady, session, profile, segments]);

  return (
    <View style={{ flex: 1, backgroundColor: Theme.colors.surface }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
        <Stack.Screen name="role-selection" options={{ headerShown: false }} />
        <Stack.Screen name="medication-details" options={{ headerShown: false }} />
        <Stack.Screen name="medication-history" options={{ headerShown: false }} />
        <Stack.Screen name="prescription-history" options={{ headerShown: false }} />
        <Stack.Screen name="paused-medications" options={{ headerShown: false }} />
        <Stack.Screen name="patient-details" options={{ headerShown: false }} />
        <Stack.Screen name="patient-directory" options={{ headerShown: false }} />
        <Stack.Screen name="pending-reviews" options={{ headerShown: false }} />
        <Stack.Screen name="review-details" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="doctor-settings" options={{ headerShown: false }} />
        <Stack.Screen name="doctor-verification" options={{ headerShown: false }} />
        <Stack.Screen name="doctor-link" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="clinical-privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <AnimatedSplashScreen isReady={isReady} />
    </View>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    'PublicSans-Regular': require('../../assets/fonts/PublicSans-Regular.ttf'),
    'PublicSans-Medium': require('../../assets/fonts/PublicSans-Medium.ttf'),
    'PublicSans-Bold': require('../../assets/fonts/PublicSans-Bold.ttf'),
    'PublicSans-ExtraBold': require('../../assets/fonts/PublicSans-ExtraBold.ttf'),
  });

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AccessibilityProvider>
          <AuthProvider>
            <RootLayoutNav fontsLoaded={fontsLoaded} />
          </AuthProvider>
        </AccessibilityProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}