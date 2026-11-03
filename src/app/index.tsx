// src/app/index.tsx
import { Redirect } from 'expo-router';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <AnimatedSplashScreen isReady={false} />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile?.role) {
    return <Redirect href="/role-selection" />;
  }

  const dest =
    profile.role === 'caregiver' || profile.role === 'doctor'
      ? '/(tabs)/caregiver-dashboard'
      : '/(tabs)/patient-dashboard';

  return <Redirect href={dest} />;
}
