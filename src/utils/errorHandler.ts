// src/utils/errorHandler.ts
import { Alert } from 'react-native';
import { crashReporter } from '../lib/crashReporter';

export interface AppError {
  message: string;
  code?: string;
  originalError?: unknown;
}

export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallbackMessage;

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, any>;

    // Common Supabase Auth / PostgREST errors
    if (err.message) {
      if (err.message.includes('Invalid login credentials')) {
        return 'Incorrect email or password. Please verify your credentials.';
      }
      if (err.message.includes('User already registered')) {
        return 'An account with this email address already exists. Please log in.';
      }
      if (err.message.includes('JWT expired') || err.message.includes('invalid claim')) {
        return 'Your session has expired. Please log in again.';
      }
      if (err.message.includes('Network request failed')) {
        return 'Network connection issue. Please check your internet connection.';
      }
      if (err.message.includes('permission denied') || err.message.includes('row-level security')) {
        return 'Access denied. You do not have permission to view or modify this record.';
      }
      return err.message;
    }

    if (err.error_description) {
      return String(err.error_description);
    }
  }

  return fallbackMessage;
}

export function handleAppError(
  error: unknown,
  context?: { component?: string; action?: string; silent?: boolean }
): AppError {
  const message = getErrorMessage(error);

  // Telemetry logging
  if (!context?.silent) {
    crashReporter.captureException(error, context);
  }

  return {
    message,
    originalError: error,
  };
}

export function showErrorAlert(
  error: unknown,
  title = 'Notice',
  onDismiss?: () => void
): void {
  const message = getErrorMessage(error);
  Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
}
