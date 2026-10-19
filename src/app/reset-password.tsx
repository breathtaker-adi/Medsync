// src/app/reset-password.tsx
import { Ionicons } from '@expo/vector-icons';
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
import { BackButton } from '../components/BackButton';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { SeniorButton } from '../components/SeniorButton';
import { authService } from '../services/authService';
import { Theme } from '../theme';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password) {
      Alert.alert('Password Required', 'Please enter a new password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.updatePassword(password);

      if (!result.success) {
        Alert.alert('Update Failed', result.error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password.');
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <BackButton fallbackRoute="/login" />
          </View>

          <View style={styles.logoWrapper}>
            <MedSyncLogo size={52} variant="stacked" animated={true} />
          </View>

          {success ? (
            <View style={styles.card}>
              <View style={styles.successIconPlate}>
                <Ionicons name="checkmark-circle" size={48} color={Theme.colors.primary} />
              </View>
              <Text style={styles.headerText}>Password Updated</Text>
              <Text style={styles.subHeaderText}>
                Your MedSync account password has been successfully updated. You can now sign in with your new credentials.
              </Text>

              <SeniorButton
                title="Sign In Now"
                onPress={() => router.replace('/login')}
                size="large"
                variant="primary"
                icon={<Ionicons name="log-in-outline" size={22} color="#FFFFFF" />}
              />
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardIconPlate}>
                <Ionicons name="key" size={30} color={Theme.colors.primary} />
              </View>
              <Text style={styles.headerText}>Set New Password</Text>
              <Text style={styles.subHeaderText}>
                Create a strong, secure password for your MedSync account.
              </Text>

              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color={Theme.colors.primary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password (min 6 chars)"
                    placeholderTextColor={Theme.colors.outline}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={Theme.colors.outline}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={22}
                    color={Theme.colors.primary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter new password"
                    placeholderTextColor={Theme.colors.outline}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </View>

              <SeniorButton
                title="Update Password"
                onPress={handleUpdatePassword}
                loading={loading}
                size="large"
                variant="primary"
                icon={<Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />}
              />

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => router.replace('/login')}
              >
                <Text style={styles.cancelLinkText}>Cancel &amp; Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
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
    flexGrow: 1,
    padding: 18,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  topBar: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Theme.shadows.cardElevated,
  },
  cardIconPlate: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  successIconPlate: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 6,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: Theme.colors.onSurface,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    height: Theme.spacing.touchTargetSenior,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: 'PublicSans-Regular',
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  eyeButton: {
    padding: 4,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
  cancelLinkText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.primary,
  },
});
