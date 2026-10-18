// src/utils/prescriptionHelper.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// In-memory cache for resolved signed URLs: path -> { url, expiresAt }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Extracts and cleans the relative storage object path from any prescription image input.
 * Strips Supabase storage URL prefixes, bucket names, and leading slashes.
 */
export function normalizePrescriptionStoragePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  // Local file or data URI
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('file://')) {
    return trimmed;
  }

  // If it's an external third-party URL (not Supabase storage), return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!trimmed.includes('/storage/v1/object/')) {
      return trimmed;
    }
  }

  // Strip full Supabase public or signed URL prefixes
  let clean = trimmed
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(public|sign)\/prescriptions\//, '')
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(public|sign)\//, '')
    .split('?')[0];

  // Strip leading bucket name if redundant (e.g. "prescriptions/...")
  clean = clean.replace(/^\/?prescriptions\//, '');
  // Strip any leading slashes
  clean = clean.replace(/^\/+/, '');

  return clean.trim() || null;
}

/**
 * Robustly resolves a stored prescription image reference to an absolute, renderable URL.
 * Handles:
 * 1. Base64 data URIs & file:// URIs
 * 2. External HTTP / HTTPS image links
 * 3. Relative Supabase Storage paths (e.g. `userId/1729..._prescription.jpg`)
 *    Resolves via 2-hour HMAC signed URL (cached), guaranteeing zero-friction rendering with private buckets.
 */
export async function resolvePrescriptionImageUrl(
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  const normalized = normalizePrescriptionStoragePath(imageUrl);
  if (!normalized) return null;

  // If it's a data URI, local file URI, or full non-Supabase web URL, return directly
  if (
    normalized.startsWith('data:image/') ||
    normalized.startsWith('file://') ||
    normalized.startsWith('http://') ||
    (normalized.startsWith('https://') && !normalized.includes('/storage/v1/object/'))
  ) {
    return normalized;
  }

  // Check cache first (valid if expires in > 5 minutes)
  const cached = signedUrlCache.get(normalized);
  if (cached && Date.now() + 300000 < cached.expiresAt) {
    return cached.url;
  }

  // 1. Try Supabase Storage signed URL (2 hours / 7200s) - works securely with DPDP private buckets
  try {
    const { data: signedData, error: signError } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(normalized, 7200);

    if (!signError && signedData?.signedUrl) {
      signedUrlCache.set(normalized, {
        url: signedData.signedUrl,
        expiresAt: Date.now() + 7000 * 1000,
      });
      return signedData.signedUrl;
    }

    if (signError) {
      console.warn('[prescriptionHelper] createSignedUrl notice:', signError.message, 'path:', normalized);
    }
  } catch (err) {
    console.warn('[prescriptionHelper] createSignedUrl exception:', err);
  }

  // 2. Fallback to Supabase Storage public URL
  try {
    const { data: pubData } = supabase.storage.from('prescriptions').getPublicUrl(normalized);
    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (err) {
    console.warn('[prescriptionHelper] getPublicUrl error:', err);
  }

  return normalized.startsWith('http') ? normalized : null;
}

/**
 * React hook that asynchronously resolves and caches signed URLs for prescription thumbnails.
 * Works seamlessly with private storage buckets and prevents flickering.
 */
export function usePrescriptionImageUrl(imageUrl: string | null | undefined): {
  url: string | null;
  loading: boolean;
} {
  const [url, setUrl] = useState<string | null>(() => {
    if (!imageUrl) return null;
    const normalized = normalizePrescriptionStoragePath(imageUrl);
    if (!normalized) return null;
    if (
      normalized.startsWith('data:image/') ||
      normalized.startsWith('file://') ||
      normalized.startsWith('http://') ||
      (normalized.startsWith('https://') && !normalized.includes('/storage/v1/object/'))
    ) {
      return normalized;
    }
    const cached = signedUrlCache.get(normalized);
    if (cached && Date.now() + 300000 < cached.expiresAt) return cached.url;
    return null;
  });

  const [loading, setLoading] = useState<boolean>(!url && !!imageUrl);

  useEffect(() => {
    let active = true;
    if (!imageUrl) {
      setUrl(null);
      setLoading(false);
      return;
    }

    const normalized = normalizePrescriptionStoragePath(imageUrl);
    if (!normalized) {
      setUrl(null);
      setLoading(false);
      return;
    }

    if (
      normalized.startsWith('data:image/') ||
      normalized.startsWith('file://') ||
      normalized.startsWith('http://') ||
      (normalized.startsWith('https://') && !normalized.includes('/storage/v1/object/'))
    ) {
      setUrl(normalized);
      setLoading(false);
      return;
    }

    const cached = signedUrlCache.get(normalized);
    if (cached && Date.now() + 300000 < cached.expiresAt) {
      setUrl(cached.url);
      setLoading(false);
      return;
    }

    setLoading(true);
    resolvePrescriptionImageUrl(imageUrl).then((resolved) => {
      if (active) {
        setUrl(resolved);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [imageUrl]);

  return { url, loading };
}

/**
 * Synchronous public URL generator for immediate fast-render in list views.
 */
export function getPrescriptionPublicUrlSync(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const normalized = normalizePrescriptionStoragePath(imageUrl);
  if (!normalized) return null;

  if (
    normalized.startsWith('data:image/') ||
    normalized.startsWith('file://') ||
    normalized.startsWith('http://') ||
    (normalized.startsWith('https://') && !normalized.includes('/storage/v1/object/'))
  ) {
    return normalized;
  }

  const cached = signedUrlCache.get(normalized);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  try {
    const { data } = supabase.storage.from('prescriptions').getPublicUrl(normalized);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}
