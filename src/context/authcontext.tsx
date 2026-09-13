// src/context/AuthContext.tsx
import { Session, User } from '@supabase/supabase-js';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  role: 'patient' | 'caregiver' | null;
  full_name: string | null;
  alerts_enabled: boolean | null;
  push_token?: string | null;
};

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Function to register for push notifications and save token
  const registerForPushNotifications = async (userId: string) => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
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
        console.log('Push notification permissions not granted!');
        return;
      }

      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: '08976e05-387f-4b74-a4bb-f2a1fdc5540b',
        })
      ).data;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // Save token to Supabase profile
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);

    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        fetchProfile(newSession.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the user's profile from the 'profiles' table
  const fetchProfile = async (user: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, alerts_enabled, push_token')
      .eq('id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        setProfile(null);
      } else {
        console.error('Error fetching profile:', error);
      }
    } else if (data) {
      setProfile(data as Profile);
      registerForPushNotifications(data.id);
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);