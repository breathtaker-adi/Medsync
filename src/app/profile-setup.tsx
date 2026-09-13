// src/app/profile-setup.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/authcontext';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileSetupScreen() {
  const { session } = useAuth();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'patient' | 'caregiver' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName || !role) {
      Alert.alert('Incomplete', 'Please enter your name and select a role.');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'Not logged in.');
      return;
    }

    setLoading(true);

    // Insert the user's details into the profiles table
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: session.user.id,
        full_name: fullName,
        role: role,
      });

    if (error) {
      Alert.alert('Error saving profile', error.message);
    } else {
      // Profile saved! Send them to the dashboard based on role
      if (role === 'patient') {
        router.replace('/(tabs)/patient-dashboard');
      } else {
        router.replace('/(tabs)/caregiver-dashboard');
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Set Up Your Profile</Text>
      <Text style={styles.subHeaderText}>Tell us a bit about yourself to get started</Text>

      {/* Name Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., John Doe"
          placeholderTextColor={Theme.colors.outline}
          value={fullName}
          onChangeText={setFullName}
        />
      </View>

      {/* Role Selection */}
      <Text style={styles.label}>I am a:</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity 
          style={[styles.roleCard, role === 'patient' && styles.roleSelected]} 
          onPress={() => setRole('patient')}
        >
          <Ionicons name="person" size={32} color={role === 'patient' ? Theme.colors.onPrimary : Theme.colors.primary} />
          <Text style={[styles.roleText, role === 'patient' && styles.roleTextSelected]}>Patient</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.roleCard, role === 'caregiver' && styles.roleSelected]} 
          onPress={() => setRole('caregiver')}
        >
          <Ionicons name="medkit" size={32} color={role === 'caregiver' ? Theme.colors.onPrimary : Theme.colors.primary} />
          <Text style={[styles.roleText, role === 'caregiver' && styles.roleTextSelected]}>Caregiver</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={handleSaveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.surface, padding: 20, paddingTop: 60 },
  headerText: { fontFamily: 'PublicSans-ExtraBold', fontSize: 32, color: Theme.colors.onSurface, marginBottom: 4 },
  subHeaderText: { fontFamily: 'PublicSans-Regular', fontSize: 16, color: Theme.colors.onSurfaceVariant, marginBottom: 32 },
  inputContainer: { marginBottom: 24 },
  label: { fontFamily: 'PublicSans-Bold', fontSize: 16, color: Theme.colors.onSurface, marginBottom: 8 },
  input: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Theme.colors.outlineVariant,
    paddingHorizontal: 16,
    fontFamily: 'PublicSans-Regular',
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  roleCard: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: Theme.colors.outlineVariant,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  roleSelected: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  roleText: { fontFamily: 'PublicSans-Bold', fontSize: 16, color: Theme.colors.primary, marginTop: 8 },
  roleTextSelected: { color: Theme.colors.onPrimary },
  continueButton: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontFamily: 'PublicSans-Bold', fontSize: 18, color: Theme.colors.onPrimary },
});