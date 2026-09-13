// src/screens/RoleSelectionScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../theme';
import { useNavigation } from '@react-navigation/native';

export default function RoleSelectionScreen() {
  // This hook allows us to navigate to the next screen when a button is pressed
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      
      {/* App Logo / Name */}
      <Text style={styles.logoText}>MedSync</Text>

      {/* Main Question */}
      <Text style={styles.questionText}>Who are you?</Text>

      {/* Patient Selection Card */}
      <TouchableOpacity 
        style={styles.roleCard} 
        // When pressed, navigate to the Medication Alert screen
        onPress={() => navigation.navigate('MedicationAlert')}
      >
        <Text style={styles.roleText}>I'm a Patient</Text>
      </TouchableOpacity>

      {/* Caregiver Selection Card (Just for visual structure right now) */}
      <TouchableOpacity style={[styles.roleCard, styles.disabledCard]}>
        <Text style={[styles.roleText, styles.disabledText]}>I'm a Caregiver</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: Theme.spacing.pageMargin,
    justifyContent: 'center', // Centers everything vertically
  },
  logoText: {
    ...Theme.typography.headlineLg,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: 40,
  },
  questionText: {
    ...Theme.typography.headlineMd,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 24,
  },
  roleCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    height: 80,
    borderRadius: Theme.rounded.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.stackGap,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5, // Shadow for Android
  },
  roleText: {
    ...Theme.typography.bodyLg,
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },
  disabledCard: {
    borderColor: Theme.colors.outlineVariant,
    backgroundColor: Theme.colors.surfaceContainer,
  },
  disabledText: {
    color: Theme.colors.onSurfaceVariant,
  }
});