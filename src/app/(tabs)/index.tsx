// src/app/(tabs)/index.tsx
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../context/authcontext';

export default function Index() {
  const { profile, loading } = useAuth();

  // Wait until auth is resolved before redirecting
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (profile?.role === 'caregiver' || profile?.role === 'doctor') {
    return <Redirect href="/(tabs)/caregiver-dashboard" />;
  }

  return <Redirect href="/(tabs)/patient-dashboard" />;
}