// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { ENV } from '../config/env';

const supabaseUrl = ENV.supabaseUrl;
const supabaseAnonKey = ENV.supabaseAnonKey;

// Secure encrypted storage adapter with chunking to handle Android's 2048-byte limit
const CHUNK_SIZE = 1800;

const EncryptedSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }

    try {
      const countStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        let result = '';
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
          if (chunk) result += chunk;
        }
        return result || null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('SecureStore getItem error:', e);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      } catch {}
      return;
    }

    try {
      if (value.length > CHUNK_SIZE) {
        const chunks = Math.ceil(value.length / CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}_chunks`, chunks.toString());
        for (let i = 0; i < chunks; i++) {
          const chunk = value.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}_${i}`, chunk);
        }
      } else {
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.warn('SecureStore setItem error:', e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      } catch {}
      return;
    }

    try {
      const countStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch (e) {
      console.warn('SecureStore removeItem error:', e);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: EncryptedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents window reference exceptions in React Native
  },
});