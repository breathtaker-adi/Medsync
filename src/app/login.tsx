// src/app/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { SeniorButton } from '../components/SeniorButton';

import { authService } from '../services/authService';
import { showErrorAlert } from '../utils/errorHandler';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const res = await authService.signUp({
        email: email.trim(),
        password,
        fullName: 'New User',
        role: 'patient',
      });

      if (!res.success) {
        showErrorAlert(res.error, 'Sign Up Failed');
      } else {
        if (res.data?.session) {
          router.replace('/role-selection');
        } else {
          Alert.alert(
            'Account Created',
            'Your MedSync account has been created! If email confirmation is required for your project, please check your inbox before signing in.',
            [{ text: 'Sign In', onPress: () => setIsSignUp(false) }]
          );
        }
      }
    } else {
      const res = await authService.signIn({
        email: email.trim(),
        password,
      });

      if (!res.success) {
        const msg = res.error?.message || '';
        if (msg.toLowerCase().includes('invalid login credentials')) {
          Alert.alert(
            'Sign In Failed',
            'Invalid email or password. If you recently reset the database or do not have an account yet, tap "Create One" below to register.',
            [
              { text: 'Try Again', style: 'cancel' },
              { text: 'Create Account', onPress: () => setIsSignUp(true) },
            ]
          );
        } else {
          showErrorAlert(res.error, 'Login Failed');
        }
      } else {
        const userId = res.data?.user?.id;
        if (userId) {
          const profRes = await authService.fetchProfile(userId);
          const prof = profRes.success ? profRes.data : null;

          if (prof?.role === 'doctor' || prof?.role === 'caregiver') {
            router.replace('/(tabs)/caregiver-dashboard');
          } else if (prof?.role === 'patient') {
            router.replace('/(tabs)/patient-dashboard');
          } else {
            router.replace('/role-selection');
          }
        } else {
          router.replace('/role-selection');
        }
      }
    }
    setLoading(false);
  };


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Theme.colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Vector Logo Header */}
        <View style={styles.logoWrapper}>
          <MedSyncLogo size={58} variant="stacked" animated={false} />
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          <Text style={styles.headerText}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subHeaderText}>
            {isSignUp
              ? 'Join MedSync for safe, synchronized medication care.'
              : 'Sign in to access your doses and caregiver network.'}
          </Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={22}
                color={Theme.colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Theme.colors.outline}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password Input with Visibility Toggle */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={Theme.colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
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
                  size={24}
                  color={Theme.colors.outline}
                />
              </TouchableOpacity>
            </View>
          </View>

          {!isSignUp && (
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/forgot-password' as any)}
              accessibilityRole="button"
              accessibilityLabel="Forgot Password? Reset your credentials"
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {isSignUp && (
            <View style={styles.consentContainer}>
              <Text style={styles.consentText}>
                By signing up, you agree to MedSync’s{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => router.push('/privacy-policy' as any)}
                >
                  Privacy Policy & DPDP Consent
                </Text>{' '}
                for encrypted prescription processing.
              </Text>
            </View>
          )}

          {/* Senior Accessible Action Button */}
          <SeniorButton
            title={isSignUp ? 'Create Account' : 'Sign In'}
            onPress={handleAuth}
            loading={loading}
            size="large"
            icon={
              <Ionicons
                name={isSignUp ? 'person-add' : 'log-in-outline'}
                size={22}
                color="#FFFFFF"
              />
            }
          />
        </View>

        {/* Toggle between Login and Sign Up */}
        <TouchableOpacity
          style={styles.signUpToggle}
          onPress={() => setIsSignUp(!isSignUp)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.toggleLink}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </Text>
        </TouchableOpacity>


      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 36 : 16,
    paddingBottom: 32,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Theme.shadows.cardElevated,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    lineHeight: 18,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 12,
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
  forgotPasswordContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  consentContainer: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  consentText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 16,
  },
  consentLink: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.primary,
    textDecorationLine: 'underline',
  },
  signUpToggle: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    includeFontPadding: false,
  },
  toggleLink: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.primary,
    textDecorationLine: 'underline',
  },
});