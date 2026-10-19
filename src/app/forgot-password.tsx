// src/app/forgot-password.tsx
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email Required', 'Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resetPassword(trimmed, 'medsync://reset-password');

      if (!result.success) {
        Alert.alert('Reset Request Failed', result.error.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
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
          {/* Top Bar with Consistent Back Navigation */}
          <View style={styles.topBar}>
            <BackButton fallbackRoute="/login" />
          </View>

          {/* Logo Header */}
          <View style={styles.logoWrapper}>
            <MedSyncLogo size={52} variant="stacked" animated={true} />
          </View>

          {sent ? (
            <View style={styles.card}>
              <View style={styles.successIconPlate}>
                <Ionicons name="checkmark-circle" size={44} color={Theme.colors.primary} />
              </View>
              <Text style={styles.successTitle}>Recovery Instructions Sent</Text>
              <Text style={styles.successBody}>
                We sent a secure password reset link to:
              </Text>
              <Text style={styles.emailHighlight}>{email}</Text>
              <Text style={styles.successNote}>
                Open the link in your email on this device to set a new password, or proceed below if you received a recovery code.
              </Text>

              <View style={styles.successActions}>
                <SeniorButton
                  title="Enter New Password"
                  onPress={() => router.push('/reset-password' as any)}
                  size="large"
                  variant="primary"
                  icon={<Ionicons name="key-outline" size={20} color="#FFFFFF" />}
                />
                <TouchableOpacity
                  style={styles.returnBtn}
                  onPress={() => router.replace('/login')}
                >
                  <Text style={styles.returnBtnText}>Return to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardIconPlate}>
                <Ionicons name="lock-open-outline" size={32} color={Theme.colors.primary} />
              </View>
              <Text style={styles.headerText}>Reset Password</Text>
              <Text style={styles.subHeaderText}>
                Enter your registered MedSync email address. We will send you secure instructions to recover your account.
              </Text>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Registered Email</Text>
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
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Action Button */}
              <SeniorButton
                title="Send Recovery Link"
                onPress={handleResetPassword}
                loading={loading}
                size="large"
                variant="primary"
                icon={<Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />}
              />

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => router.replace('/login')}
              >
                <Ionicons name="arrow-back" size={16} color={Theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.cancelLinkText}>Back to Sign In</Text>
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
    marginBottom: 16,
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
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
  cancelLinkText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.primary,
  },
  successIconPlate: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 21,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 6,
  },
  successBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emailHighlight: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  successNote: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 10,
    borderRadius: 10,
  },
  successActions: {
    width: '100%',
    gap: 12,
  },
  returnBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  returnBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.primary,
  },
});
