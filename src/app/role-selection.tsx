// src/app/role-selection.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useRouter } from 'expo-router';
import { Theme } from '../theme';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectionScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', 'Failed to log out.');
    } else {
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logoText}>MedSync</Text>
        <Text style={styles.headerText}>Who are you?</Text>
        <Text style={styles.subHeaderText}>Select your role to continue</Text>

        <View style={styles.spacer} />

        {/* Patient Button */}
        <TouchableOpacity 
          style={styles.roleCard} 
          onPress={() => router.replace('/(tabs)/patient-dashboard')}
        >
          <Ionicons name="person" size={32} color={Theme.colors.primary} style={styles.icon} />
          <View style={styles.textContainer}>
            <Text style={styles.roleTitle}>I'm a Patient</Text>
            <Text style={styles.roleDesc}>Track medications & set alarms</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.outline} />
        </TouchableOpacity>

        {/* Caregiver Button */}
        <TouchableOpacity 
          style={styles.roleCard} 
          onPress={() => router.replace('/(tabs)/caregiver-dashboard')}
        >
          <Ionicons name="medkit" size={32} color={Theme.colors.primary} style={styles.icon} />
          <View style={styles.textContainer}>
            <Text style={styles.roleTitle}>I'm a Caregiver</Text>
            <Text style={styles.roleDesc}>Review prescriptions & monitor patients</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.outline} />
        </TouchableOpacity>
      </View>

      {/* Logout Button at the bottom */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'space-between', // Pushes logout to the bottom
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 36,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: 40,
  },
  headerText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 28,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 40,
  },
  spacer: {
    height: 20,
  },
  roleCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  roleTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  roleDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  logoutButton: {
    padding: 20,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.error,
  },
});