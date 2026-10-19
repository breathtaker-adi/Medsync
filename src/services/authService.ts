import AsyncStorage from '@react-native-async-storage/async-storage';
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
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Handle transient PGRST303 (JWT issued at future / clock skew) with a quick backoff retry
      if (error && ((error as any).code === 'PGRST303' || error.message?.includes('JWT issued at future'))) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const retry = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

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
   * Set user role (patient, caregiver, doctor) and sync auth metadata
   */
  async setRole(
    userId: string,
    role: UserRole,
    fullName?: string
  ): Promise<Result<void>> {
    try {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          role,
          full_name: fullName || (role === 'caregiver' ? 'Caregiver' : 'User'),
          is_verified_doctor: role === 'doctor',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        handleAppError(profileError, { action: 'setRole' });
        return err(new Error(getErrorMessage(profileError)));
      }

      await supabase.auth.updateUser({
        data: { role },
      });

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'setRole' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Initialize or update profile during onboarding setup
   */
  async setupProfile(
    userId: string,
    data: {
      fullName: string;
      role: UserRole;
      bloodGroup?: string | null;
      allergies?: string | null;
    }
  ): Promise<Result<void>> {
    try {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: data.fullName.trim(),
          role: data.role,
          blood_group: data.bloodGroup || null,
          allergies: data.allergies || null,
          is_verified_doctor: data.role === 'doctor',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        handleAppError(profileError, { action: 'setupProfile' });
        return err(new Error(getErrorMessage(profileError)));
      }

      await supabase.auth.updateUser({
        data: {
          full_name: data.fullName.trim(),
          role: data.role,
        },
      });

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'setupProfile' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Trigger password reset email via Supabase Auth
   */
  async resetPassword(email: string, redirectTo?: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo || 'medsync://reset-password',
      });

      if (error) {
        handleAppError(error, { action: 'resetPassword' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'resetPassword' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update password for active authenticated session
   */
  async updatePassword(password: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        handleAppError(error, { action: 'updatePassword' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updatePassword' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update account email address
   */
  async updateUserEmail(email: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });

      if (error) {
        handleAppError(error, { action: 'updateUserEmail' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updateUserEmail' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update user metadata (full_name, phone, emergency contact, etc.)
   */
  async updateUserMetadata(metadata: Record<string, any>): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.updateUser({ data: metadata });

      if (error) {
        handleAppError(error, { action: 'updateUserMetadata' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updateUserMetadata' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Log DPDP Act consent artifact to database
   */
  async recordUserConsent(
    userId: string,
    consentType: string = 'dpdp_ocr_processing',
    version: string = '1.0'
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('user_consents').upsert(
        {
          user_id: userId,
          consent_type: consentType,
          consent_version: version,
          consented_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, consent_type' }
      );

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'recordUserConsent' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Delete account and permanently purge all personal health data
   * in compliance with India DPDP Act 2023 Right to Erasure.
   */
  async deleteAccount(): Promise<Result<{ success: boolean; message: string }>> {
    try {
      const { data, error } = await supabase.rpc('delete_user_account');

      if (error) {
        handleAppError(error, { action: 'deleteAccount' });
        return err(new Error(getErrorMessage(error)));
      }

      // Purge local persistent device storage & caches
      try {
        await AsyncStorage.clear();
      } catch (storageErr) {
        console.warn('[authService] Local storage clear warning:', storageErr);
      }

      // Terminate client auth session
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('[authService] Session signout warning:', signOutErr);
      }

      return ok(data || { success: true, message: 'Account deleted' });
    } catch (caught: any) {
      handleAppError(caught, { action: 'deleteAccount' });
      return err(new Error(getErrorMessage(caught)));
    }
  },
};
