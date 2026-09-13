import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useAuth } from '../../context/authcontext';
import { Theme } from '../../theme';

export default function TabsLayout() {
  const { profile } = useAuth();  

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.outline,
        tabBarStyle: {
          height: 80,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: 'PublicSans-Bold',
          fontSize: 12,
        },
      }}
    >
      {/* Patient & Caregiver Dashboards are hidden from the tab bar, but registered! */}
      <Tabs.Screen 
        name="patient-dashboard" 
        options={{ 
          href: null, // Hides from tab bar
          title: 'Today',
        }} 
      />
      <Tabs.Screen 
        name="caregiver-dashboard" 
        options={{ 
          href: null, // Hides from tab bar
          title: 'Dashboard',
        }} 
      />
      
      {/* Visible Tab Screens */}
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Today', 
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
          href: null // Usually index is hidden if it just redirects
        }} 
      />
      <Tabs.Screen 
        name="uploads" 
        options={{ 
          title: 'Uploads', 
          tabBarIcon: ({ color }) => <Ionicons name="cloud-upload" size={24} color={color} />,
          href: profile?.role === 'caregiver' ? null : undefined,
        }} 
      />
    </Tabs>
  );
}