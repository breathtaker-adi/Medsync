// src/app/forgot-password.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { SeniorButton } from '../components/SeniorButton';
import { BackButton } from '../components/BackButton';

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
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'medsync://reset-password',
      });

      if (error) {
        Alert.alert('Reset Request Failed', error.message);
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Theme.colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          fallbackRoute="/login"
          style={{ alignSelf: 'flex-start', marginBottom: 20 }}
        />

        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={Theme.colors.primary} />
        </View>

        <Text style={styles.headerText}>Reset Password</Text>
        <Text style={styles.subHeaderText}>
          Enter your registered email address to receive secure password recovery instructions.
        </Text>

        {sent ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={40} color={Theme.colors.success} />
            <Text style={styles.successTitle}>Recovery Email Sent</Text>
            <Text style={styles.successBody}>
              Please check your inbox at <Text style={{ fontWeight: 'bold' }}>{email}</Text> and follow the link to set your new password.
            </Text>
            <SeniorButton
              title="Return to Login"
              onPress={() => router.replace('/login')}
              variant="outline"
              size="normal"
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={Theme.colors.outline}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <SeniorButton
              title="Send Recovery Link"
              onPress={handleResetPassword}
              loading={loading}
              size="large"
              variant="primary"
              icon={<Ionicons name="mail-outline" size={22} color="#FFFFFF" />}
              style={{ marginBottom: 14 }}
            />

            <TouchableOpacity style={styles.cancelLink} onPress={() => router.back()}>
              <Text style={styles.cancelLinkText}>Cancel & Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 28,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    paddingHorizontal: 16,
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  actionButton: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  cancelLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  cancelLinkText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.outline,
  },
  successCard: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  successTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
    marginTop: 12,
    marginBottom: 8,
  },
  successBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backToLoginButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  backToLoginText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onPrimary,
  },
});
