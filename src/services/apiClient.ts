// src/services/apiClient.ts
import { supabase } from '../lib/supabase';
import { Result, ok, err } from '../types/api';
import { handleAppError, getErrorMessage } from '../utils/errorHandler';

/**
 * Executes a Supabase or asynchronous API call with standardized error handling
 * and returns a type-safe Result<T>.
 */
export async function safeApiCall<T>(
  apiFn: () => Promise<{ data: T | null; error: any }>,
  actionName = 'API Request'
): Promise<Result<T>> {
  try {
    const { data, error } = await apiFn();

    if (error) {
      handleAppError(error, { action: actionName });
      return err(new Error(getErrorMessage(error)));
    }

    return ok(data as T);
  } catch (caughtError: any) {
    handleAppError(caughtError, { action: actionName });
    return err(new Error(getErrorMessage(caughtError)));
  }
}

export { supabase };
