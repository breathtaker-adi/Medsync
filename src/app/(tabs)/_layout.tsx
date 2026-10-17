import React, { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet, BackHandler, ToastAndroid } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../context/authcontext';
import { Theme } from '../../theme';

export default function TabsLayout() {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const lastBackPressRef = useRef<number>(0);
  const isCaregiverOrDoctor = profile?.role === 'caregiver' || profile?.role === 'doctor';

  useEffect(() => {
    const onBackPress = () => {
      // 1. If there's a screen in the stack history to pop, navigate back
      if (router.canGoBack()) {
        router.back();
        return true;
      }

      // 2. If user is on a secondary tab (like uploads), return to the main home dashboard tab
      const isHomeTab =
        pathname === '/(tabs)/patient-dashboard' ||
        pathname === '/(tabs)/caregiver-dashboard' ||
        pathname === '/patient-dashboard' ||
        pathname === '/caregiver-dashboard';

      if (!isHomeTab) {
        if (isCaregiverOrDoctor) {
          router.navigate('/(tabs)/caregiver-dashboard');
        } else {
          router.navigate('/(tabs)/patient-dashboard');
        }
        return true;
      }

      // 3. Root screen reached: Require double-back press within 2000ms to exit
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [router, pathname, isCaregiverOrDoctor]);

  return (
    <>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.outline,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          height: Platform.OS === 'ios' ? 76 : 58,
          paddingBottom: Platform.OS === 'ios' ? 20 : 6,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'PublicSans-Bold',
          fontSize: 11,
          marginTop: 1,
        },
      }}
    >
      {/* 1. Patient Daily Schedule (Visible for Patient) */}
      <Tabs.Screen
        name="patient-dashboard"
        options={{
          title: 'Today’s Doses',
          tabBarLabel: 'Today',
          href: isCaregiverOrDoctor ? null : '/(tabs)/patient-dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={22}
                color={focused ? Theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />

      {/* 2. Caregiver / Clinician Surveillance Dashboard (Visible for Caregiver/Doctor) */}
      <Tabs.Screen
        name="caregiver-dashboard"
        options={{
          title: 'Patients',
          tabBarLabel: 'Patients',
          href: isCaregiverOrDoctor ? '/(tabs)/caregiver-dashboard' : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={22}
                color={focused ? Theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />

      {/* 3. Prescription Upload / Scan (Visible for Patient) */}
      <Tabs.Screen
        name="uploads"
        options={{
          title: 'Scan Slip',
          tabBarLabel: 'Scan Slip',
          href: isCaregiverOrDoctor ? null : '/(tabs)/uploads',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconWrapper]}>
              <Ionicons
                name={focused ? 'camera' : 'camera-outline'}
                size={22}
                color={focused ? Theme.colors.primary : color}
              />
            </View>
          ),
        }}
      />

      {/* 4. Internal redirect index (Always hidden from UI) */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 26,
    borderRadius: 13,
  },
  activeIconWrapper: {
    backgroundColor: '#E6F4F4',
  },
});