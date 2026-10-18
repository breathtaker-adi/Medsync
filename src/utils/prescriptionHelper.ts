// src/utils/prescriptionHelper.ts
import { supabase } from '../lib/supabase';

/**
 * Robustly resolves a stored prescription image reference to an absolute, renderable URL.
 * Handles:
 * 1. Pre-resolved HTTP / HTTPS URLs
 * 2. Base64 data URIs
 * 3. Relative Supabase Storage paths (e.g. `userId/1729..._prescription.jpg`)
 *    Resolves via Public URL first, then fallbacks to 24-hour signed URLs.
 */
export async function resolvePrescriptionImageUrl(
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  // 1. If it's already an absolute web URL, local file URI, or base64 data URI
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed;
  }

  // 2. Try Supabase Storage public URL
  try {
    const { data: pubData } = supabase.storage.from('prescriptions').getPublicUrl(trimmed);
    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (err) {
    console.warn('[prescriptionHelper] getPublicUrl error:', err);
  }

  // 3. Try Supabase Storage signed URL (24 hours)
  try {
    const { data: signedData } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(trimmed, 86400);
    if (signedData?.signedUrl) {
      return signedData.signedUrl;
    }
  } catch (err) {
    console.warn('[prescriptionHelper] createSignedUrl error:', err);
  }

  return null;
}

/**
 * Synchronous public URL generator for immediate fast-render in list views.
 */
export function getPrescriptionPublicUrlSync(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed;
  }

  try {
    const { data } = supabase.storage.from('prescriptions').getPublicUrl(trimmed);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}
