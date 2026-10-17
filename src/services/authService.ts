// src/services/authService.ts
import { supabase } from '../lib/supabase';
import { Result, ok, err } from '../types/api';
import { AuthCredentials, SignUpData, UserProfile, UserRole } from '../types/auth';
import { handleAppError, getErrorMessage } from '../utils/errorHandler';

export const authService = {
  /**
   * Authenticate an existing user with email and password
   */
  async signIn({ email, password }: AuthCredentials): Promise<Result<{ user: any; session: any }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        handleAppError(error, { action: 'signIn' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(data);
    } catch (caught: any) {
      handleAppError(caught, { action: 'signIn' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Register a new user and initialize their profile record
   */
  async signUp({
    email,
    password,
    fullName,
    role,
    bloodGroup,
    allergies,
  }: SignUpData): Promise<Result<{ user: any; session: any }>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        handleAppError(error, { action: 'signUp' });
        return err(new Error(getErrorMessage(error)));
      }

      if (data.user) {
        // Initialize profile
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          role,
          blood_group: bloodGroup || null,
          allergies: allergies || null,
          is_verified_doctor: role === 'doctor',
        });

        if (profileError) {
          console.warn('[authService] Profile init warning:', profileError);
        }
      }

      return ok(data);
    } catch (caught: any) {
      handleAppError(caught, { action: 'signUp' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Sign out the current authenticated user
   */
  async signOut(): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        handleAppError(error, { action: 'signOut' });
        return err(new Error(getErrorMessage(error)));
      }
      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'signOut' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch user profile from database
   */
  async fetchProfile(userId: string): Promise<Result<UserProfile>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, alerts_enabled, push_token, is_verified_doctor, blood_group, allergies')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        handleAppError(error, { action: 'fetchProfile' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(data as UserProfile);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchProfile' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update profile fields (e.g. alerts_enabled, full_name, blood_group)
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        handleAppError(error, { action: 'updateProfile' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updateProfile' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Demo account quick-login with seed initialization
   */
  async signInWithDemo(role: 'doctor' | 'patient'): Promise<Result<{ user: any; session: any }>> {
    if (!__DEV__) {
      return err(new Error('Demo accounts are disabled in production builds for security.'));
    }
    const demoEmail = role === 'doctor' ? 'doctor@medsync.demo' : 'patient@medsync.demo';
    const demoPassword = 'Password123!';

    const signInRes = await this.signIn({ email: demoEmail, password: demoPassword });
    if (signInRes.success) {
      return signInRes;
    }

    // If account does not exist yet, create it
    const signUpRes = await this.signUp({
      email: demoEmail,
      password: demoPassword,
      fullName: role === 'doctor' ? 'Dr. Evelyn Reed, MD' : 'Eleanor Vance',
      role,
      bloodGroup: role === 'patient' ? 'O+' : undefined,
      allergies: role === 'patient' ? 'Penicillin, Sulfa drugs' : undefined,
    });

    return signUpRes;
  },
};
