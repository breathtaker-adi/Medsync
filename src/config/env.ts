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
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  if (!supabaseUrl && !__DEV__) {
    console.error('[Config Error] EXPO_PUBLIC_SUPABASE_URL is missing!');
  }

  if (!supabaseAnonKey && !__DEV__) {
    console.error('[Config Error] EXPO_PUBLIC_SUPABASE_ANON_KEY is missing!');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    isDev: __DEV__,
  };
}

export const ENV: AppConfig = validateEnv();

export default ENV;
