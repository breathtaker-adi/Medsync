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
import { AuthProvider, useAuth } from '../context/authcontext';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { supabase } from '../lib/supabase';
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
          const today = new Date().toISOString().split('T')[0];

          // Get active user session
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          if (!currentSession?.user?.id) return;

          // Attempt atomic take_dose RPC to avoid race conditions with app taps
          const { error: rpcError } = await supabase.rpc('take_dose', {
            p_medication_id: medId,
            p_scheduled_time: '00:00',
          });

          if (rpcError) {
            console.warn('take_dose RPC failed or not deployed, using client fallback:', rpcError);
            // Fetch current medication data
            const { data: med } = await supabase
              .from('medications')
              .select('time, pills_remaining')
              .eq('id', medId)
              .single();

            // Log daily intake
            await supabase.from('medication_logs').upsert(
              {
                medication_id: medId,
                patient_id: currentSession.user.id,
                log_date: today,
                scheduled_time: med?.time || '00:00',
                status: 'taken',
              },
              { onConflict: 'medication_id, log_date' }
            );

            // Decrement pill counter
            if (med) {
              const newPills = Math.max(0, (med.pills_remaining ?? 30) - 1);
              await supabase
                .from('medications')
                .update({ pills_remaining: newPills })
                .eq('id', medId);
            }
          }

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

    const inAuthGroup = segments[0] === 'login';
    const inSetup = segments[0] === 'profile-setup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session) {
      if (!profile && !inSetup) {
        // Logged in without a profile -> complete setup
        router.replace('/profile-setup');
      } else if (profile && (inAuthGroup || inSetup)) {
        // Profile exists -> redirect using router.replace to avoid building stack history
        if (profile.role && ['caregiver', 'doctor'].includes(profile.role)) {
          router.replace('/(tabs)/caregiver-dashboard');
        } else if (profile.role === 'patient') {
          router.replace('/(tabs)/patient-dashboard');
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
        <Stack.Screen name="patient-details" options={{ headerShown: false }} />
        <Stack.Screen name="patient-directory" options={{ headerShown: false }} />
        <Stack.Screen name="review-details" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="doctor-settings" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
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