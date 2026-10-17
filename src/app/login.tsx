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
import { supabase } from '../lib/supabase';
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
        Alert.alert('Success', 'Account created! If email confirmation is required, please check your inbox.');
      }
    } else {
      const res = await authService.signIn({
        email: email.trim(),
        password,
      });

      if (!res.success) {
        showErrorAlert(res.error, 'Login Failed');
      } else {
        router.replace('/role-selection');
      }
    }
    setLoading(false);
  };

  const handleQuickDemo = async (role: 'doctor' | 'patient') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const demoEmail = role === 'doctor' ? 'doctor@medsync.demo' : 'patient@medsync.demo';
    const demoPassword = 'Password123!';

    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);

    const res = await authService.signInWithDemo(role);

    if (res.success) {
      if (role === 'doctor') {
        router.replace('/(tabs)/caregiver-dashboard');
      } else {
        router.replace('/(tabs)/patient-dashboard');
      }
    } else {
      showErrorAlert(res.error, 'Demo Login Failed');
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
          <MedSyncLogo size={58} variant="stacked" animated={true} />
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
        >
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
          </Text>
        </TouchableOpacity>

        {/* One-Tap Demo Exploration Card (Development Only) */}
        {__DEV__ && (
          <View style={styles.demoCard}>
            <View style={styles.demoHeaderRow}>
              <Ionicons name="sparkles" size={18} color={Theme.colors.primary} />
              <Text style={styles.demoHeaderTitle}>ONE-TAP DEMO EXPLORATION (DEV ONLY)</Text>
            </View>
            <Text style={styles.demoHeaderSubtitle}>
              Try MedSync with pre-filled clinical and senior patient details:
            </Text>

            <View style={styles.demoButtonsContainer}>
              {/* Demo Doctor Button */}
              <TouchableOpacity
                style={styles.demoItemBtn}
                onPress={() => handleQuickDemo('doctor')}
                activeOpacity={0.8}
              >
                <View style={[styles.demoIconPlate, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="medkit" size={24} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoItemName}>Dr. Evelyn Reed, MD</Text>
                  <Text style={styles.demoItemSubtitle}>Verified Doctor • Clinic Dashboard</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.primary} />
              </TouchableOpacity>

              {/* Demo Patient Button */}
              <TouchableOpacity
                style={styles.demoItemBtn}
                onPress={() => handleQuickDemo('patient')}
                activeOpacity={0.8}
              >
                <View style={[styles.demoIconPlate, { backgroundColor: '#E8F5F5' }]}>
                  <Ionicons name="person" size={24} color={Theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoItemName}>Martha Davis (74y)</Text>
                  <Text style={styles.demoItemSubtitle}>Senior Patient • 4 Active Doses</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: 14,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.primary,
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
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.primary,
  },
  demoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  demoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  demoHeaderTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.primary,
    letterSpacing: 0.8,
  },
  demoHeaderSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 10,
    lineHeight: 16,
  },
  demoButtonsContainer: {
    gap: 8,
  },
  demoItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    gap: 10,
  },
  demoIconPlate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoItemName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  demoItemSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
});