// src/types/api.ts

export type Result<T, E = Error> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}
