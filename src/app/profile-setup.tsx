import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { SeniorButton } from '../components/SeniorButton';
import { BackButton } from '../components/BackButton';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Theme } from '../theme';

export default function ProfileSetupScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(
    profile?.full_name || session?.user?.user_metadata?.full_name || ''
  );
  const [role, setRole] = useState<'patient' | 'caregiver' | null>(
    (profile?.role as any) === 'caregiver' || (profile?.role as any) === 'patient'
      ? (profile?.role as any)
      : (session?.user?.user_metadata?.role as any) === 'caregiver' ||
        (session?.user?.user_metadata?.role as any) === 'patient'
      ? (session?.user?.user_metadata?.role as any)
      : null
  );
  const [loading, setLoading] = useState(false);

  const handleSelectRole = (selectedRole: 'patient' | 'caregiver') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRole(selectedRole);
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name so your health team recognizes you.');
      return;
    }

    if (!role) {
      Alert.alert('Role Required', 'Please choose whether you are a Patient or a Caregiver.');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'Session not found. Please log in again.');
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.setupProfile(session.user.id, {
        fullName: fullName.trim(),
        role,
      });

      if (!result.success) {
        Alert.alert('Error saving profile', result.error.message);
      } else {
        await refreshProfile();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (role === 'patient') {
          router.replace('/(tabs)/patient-dashboard');
        } else {
          router.replace('/(tabs)/caregiver-dashboard');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <BackButton fallbackRoute="/login" />
          </View>

          {/* Branded Header */}
          <View style={styles.brandHeader}>
            <MedSyncLogo size={54} variant="badge" animated={true} />
            <Text style={styles.headerTitle}>Welcome to MedSync</Text>
            <Text style={styles.headerSubtitle}>
              Let's personalize your daily medication companion
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>YOUR FULL NAME</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={24}
                  color={Theme.colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor={Theme.colors.outline}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Role Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>I WILL BE USING MEDSYNC AS:</Text>

              <View style={styles.roleGrid}>
                {/* Patient Role Card */}
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'patient' && styles.roleCardActive,
                  ]}
                  onPress={() => handleSelectRole('patient')}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: role === 'patient' }}
                >
                  <View
                    style={[
                      styles.roleIconPlate,
                      role === 'patient' && styles.roleIconPlateActive,
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={32}
                      color={
                        role === 'patient'
                          ? Theme.colors.onPrimary
                          : Theme.colors.primary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.roleTitle,
                      role === 'patient' && styles.roleTitleActive,
                    ]}
                  >
                    Patient
                  </Text>
                  <Text
                    style={[
                      styles.roleDesc,
                      role === 'patient' && styles.roleDescActive,
                    ]}
                  >
                    Take pills on time, track health & get gentle reminders
                  </Text>
                  {role === 'patient' && (
                    <View style={styles.checkPill}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Caregiver Role Card */}
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'caregiver' && styles.roleCardActiveCaregiver,
                  ]}
                  onPress={() => handleSelectRole('caregiver')}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: role === 'caregiver' }}
                >
                  <View
                    style={[
                      styles.roleIconPlate,
                      role === 'caregiver' && styles.roleIconPlateActiveCaregiver,
                    ]}
                  >
                    <Ionicons
                      name="heart-half"
                      size={32}
                      color={
                        role === 'caregiver'
                          ? '#FFFFFF'
                          : Theme.colors.secondary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.roleTitle,
                      role === 'caregiver' && styles.roleTitleActive,
                    ]}
                  >
                    Caregiver
                  </Text>
                  <Text
                    style={[
                      styles.roleDesc,
                      role === 'caregiver' && styles.roleDescActive,
                    ]}
                  >
                    Monitor loved ones, review prescriptions & alerts
                  </Text>
                  {role === 'caregiver' && (
                    <View style={[styles.checkPill, { backgroundColor: Theme.colors.secondary }]}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Senior Submit Action */}
            <SeniorButton
              title="Save & Continue"
              icon="arrow-forward-circle"
              variant="primary"
              loading={loading}
              onPress={handleSaveProfile}
              style={{ marginTop: 12 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  topBar: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 21,
    color: Theme.colors.onSurface,
    marginTop: 10,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    ...Theme.elevation.level2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: 'PublicSans-Medium',
    fontSize: 15,
    color: Theme.colors.onSurface,
    paddingVertical: 10,
  },
  roleGrid: {
    gap: 10,
    marginTop: 2,
  },
  roleCard: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  roleCardActive: {
    backgroundColor: '#E8F5F5',
    borderColor: Theme.colors.primary,
    borderWidth: 2,
  },
  roleCardActiveCaregiver: {
    backgroundColor: '#EBF4F9',
    borderColor: Theme.colors.secondary,
    borderWidth: 2,
  },
  roleIconPlate: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Theme.elevation.level1,
  },
  roleIconPlateActive: {
    backgroundColor: Theme.colors.primary,
  },
  roleIconPlateActiveCaregiver: {
    backgroundColor: Theme.colors.secondary,
  },
  roleTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 2,
  },
  roleTitleActive: {
    color: Theme.colors.onSurface,
  },
  roleDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  roleDescActive: {
    color: Theme.colors.onSurface,
  },
  checkPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    padding: 2,
  },
});