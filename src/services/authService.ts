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
        options: {
          data: {
            full_name: fullName.trim(),
            role: role || 'patient',
          },
        },
      });

      if (error) {
        handleAppError(error, { action: 'signUp' });
        return err(new Error(getErrorMessage(error)));
      }

      if (data.session && data.user) {
        // Initialize profile if active session was established
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            full_name: fullName.trim(),
            role,
            blood_group: bloodGroup || null,
            allergies: allergies || null,
            is_verified_doctor: role === 'doctor',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

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
        .select('*')
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


};
