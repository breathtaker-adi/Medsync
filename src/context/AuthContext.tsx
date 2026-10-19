// src/context/AuthContext.tsx
import { Session } from '@supabase/supabase-js';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ENV } from '../config/env';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import { UserProfile } from '../types/auth';

export interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const registerForPushNotifications = async (userId: string) => {
    if (!Device.isDevice) {
      return;
    }

    // Expo Go on Android does not support remote push notifications since SDK 53
    const isExpoGo =
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    if (isExpoGo) {
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return;
      }

      const easProjectId =
        ENV.easProjectId || Constants.expoConfig?.extra?.eas?.projectId;

      const token = (
        await Notifications.getExpoPushTokenAsync(
          easProjectId ? { projectId: easProjectId } : undefined
        )
      ).data;

      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        } catch {
          // Channel creation unsupported in current environment
        }
      }

      try {
        await supabase
          .from('user_push_tokens')
          .upsert({ user_id: userId, push_token: token, updated_at: new Date().toISOString() });
      } catch {}

      try {
        await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', userId);
      } catch {}
    } catch {
      // Gracefully silent in environments without push support
    }
  };

  const loadProfile = async (userId: string) => {
    const res = await authService.fetchProfile(userId);
    if (res.success && res.data) {
      setProfile(res.data);
      registerForPushNotifications(res.data.id);
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      await loadProfile(session.user.id);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await authService.signOut();
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        setLoading(true);
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;