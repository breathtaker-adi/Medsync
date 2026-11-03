// src/lib/crashReporter.ts
/**
 * MedSync Crash & Diagnostic Reporting Service
 * Connects to Sentry or compatible error monitoring when EXPO_PUBLIC_SENTRY_DSN is configured.
 */

import { ENV } from '../config/env';

interface ErrorContext {
  [key: string]: any;
}

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

class CrashReporter {
  private isInitialized = false;
  private dsn: string | undefined;
  private parsedDsn: ParsedDsn | null = null;

  constructor() {
    this.dsn = ENV.sentryDsn;
    if (this.dsn) {
      this.parsedDsn = this.parseDsn(this.dsn);
      if (this.parsedDsn) {
        this.isInitialized = true;
        if (ENV.isDev) {
          console.log('Crash reporter initialized with Sentry DSN');
        }
      }
    }
  }

  private parseDsn(dsn: string): ParsedDsn | null {
    // Format: https://<publicKey>@<host>/<projectId>
    const match = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!match) return null;
    return {
      publicKey: match[1],
      host: match[2],
      projectId: match[3],
    };
  }

  public captureException(error: Error | any, context?: ErrorContext) {
    if (ENV.isDev) {
      console.error('[CrashReporter DEV]', error, context);
      return;
    }

    if (this.isInitialized && this.parsedDsn) {
      try {
        const eventId = Math.random().toString(36).substring(2, 18);
        const envelopeUrl = `https://${this.parsedDsn.host}/api/${this.parsedDsn.projectId}/envelope/`;
        const authHeader =
          `Sentry sentry_key=${this.parsedDsn.publicKey},` +
          `sentry_client=medsync-crashreporter/1.0,` +
          `sentry_version=7`;

        const header = { event_id: eventId, sent_at: new Date().toISOString() };
        const item = { type: 'event' };
        const eventBody = {
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

        const body =
          JSON.stringify(header) + '\n' +
          JSON.stringify(item) + '\n' +
          JSON.stringify(eventBody);

        // Non-blocking telemetry dispatch via valid Sentry envelope
        fetch(envelopeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'X-Sentry-Auth': authHeader,
          },
          body,
        }).catch(() => {
          // Suppress network reporting errors
        });
      } catch (err) {
        // Suppress client logging failure
      }
    }
  }

  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (ENV.isDev) {
      console.log(`[CrashReporter ${level.toUpperCase()}]`, message);
    }
  }
}

export const crashReporter = new CrashReporter();
