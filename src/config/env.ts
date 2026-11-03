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

function validateEnv(): AppConfig {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[FATAL] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'Copy .env.example to .env and configure valid credentials.'
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production',
  };
}

export const ENV: AppConfig = validateEnv();

export default ENV;
