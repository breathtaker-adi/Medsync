// src/lib/crashReporter.ts
/**
 * MedSync Crash & Diagnostic Reporting Service
 * Connects to Sentry or compatible error monitoring when EXPO_PUBLIC_SENTRY_DSN is configured.
 */

import { ENV } from '../config/env';

interface ErrorContext {
  [key: string]: any;
}

class CrashReporter {
  private isInitialized = false;
  private dsn: string | undefined;

  constructor() {
    this.dsn = ENV.sentryDsn;
    if (this.dsn) {
      this.isInitialized = true;
      console.log('Crash reporter initialized with Sentry DSN');
    }
  }

  public captureException(error: Error | any, context?: ErrorContext) {
    if (ENV.isDev) {
      console.error('[CrashReporter DEV]', error, context);
      return;
    }

    if (this.isInitialized && this.dsn) {
      try {
        // Send to Sentry envelope endpoint via standard fetch
        const eventId = Math.random().toString(36).substring(2, 15);
        const payload = {
          event_id: eventId,
          timestamp: new Date().toISOString(),
          platform: 'javascript',
          level: 'error',
          exception: {
            values: [
              {
                type: error?.name || 'Error',
                value: error?.message || String(error),
                stacktrace: error?.stack ? { frames: [] } : undefined,
              },
            ],
          },
          extra: context,
        };

        // Non-blocking telemetry dispatch
        fetch(this.dsn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Suppress network reporting errors
        });
      } catch (err) {
        console.error('Failed to log exception to crash reporter:', err);
      }
    }
  }

  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (__DEV__) {
      console.log(`[CrashReporter ${level.toUpperCase()}]`, message);
    }
  }
}

export const crashReporter = new CrashReporter();
