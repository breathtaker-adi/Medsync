/**
 * MedSync Environment Configuration Module
 * Validates and exposes typed environment variables to decouple configuration from code.
 */

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId?: string;
  sentryDsn?: string;
  isDev: boolean;
}

// Fallback constants for local dev/preview builds
const DEFAULT_SUPABASE_URL = 'https://kvbjmkadnavvajwxcepj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_M_bF5TvIBj5AdhKLYPmh3w_uOQn-RQL';

function validateEnv(): AppConfig {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || (__DEV__ ? DEFAULT_SUPABASE_URL : '');
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (__DEV__ ? DEFAULT_SUPABASE_ANON_KEY : '');

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = '[Security Alert] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be configured in environment variables.';
    if (!__DEV__) {
      throw new Error(errorMsg);
    } else {
      console.warn(errorMsg);
    }
  }

  return {
    supabaseUrl: supabaseUrl || DEFAULT_SUPABASE_URL,
    supabaseAnonKey: supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY,
    easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    isDev: __DEV__,
  };
}

export const ENV: AppConfig = validateEnv();

export default ENV;
