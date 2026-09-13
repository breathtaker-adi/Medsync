// src/app/login.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // New state to toggle Sign Up/Login

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    
    if (isSignUp) {
      // Sign Up Logic
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });
      
      if (error) {
        Alert.alert('Sign Up Failed', error.message);
      } else {
        Alert.alert('Success', 'Account created! Check your email for verification if required.');
        // After sign up, Supabase usually logs them in automatically.
        // Our AuthContext will detect the new session and route them to profile-setup!
      }
    } else {
      // Login Logic
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
      } else {
        router.replace('/role-selection'); // Or rely on AuthContext to route them
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
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logoText}>MedSync</Text>
        <Text style={styles.headerText}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
        <Text style={styles.subHeaderText}>{isSignUp ? 'Sign up to get started' : 'Please sign in to continue'}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Theme.colors.outline}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Theme.colors.outline}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleAuth} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
          )}
        </TouchableOpacity>

        {/* Toggle between Login and Sign Up */}
        <TouchableOpacity style={styles.signUpToggle} onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.toggleText}>
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 28,
    color: Theme.colors.primary,
    textAlign: 'center',
    marginBottom: 40,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 8,
  },
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
  loginButton: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  loginButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onPrimary,
  },
  signUpToggle: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.primary,
  }
});