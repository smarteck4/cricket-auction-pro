// Cloudinary image-upload orchestration for the Create/Edit Player flows.
// Extracted from Admin.tsx so the create/edit -> Cloudinary integration can be
// exercised in isolation by integration tests.

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export interface CloudinaryInvokeResult {
  data: { secure_url?: string; public_id?: string; error?: string } | null;
  error: { message?: string } | null;
}

/** Minimal shape of the Supabase client used by these helpers. */
export interface SupabaseLike {
  functions: {
    invoke: (name: string, opts: { body: unknown }) => Promise<CloudinaryInvokeResult>;
  };
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

export type ImageValidation =
  | { ok: true }
  | { ok: false; reason: 'type' | 'size' };

export function validateImageFile(file: { type: string; size: number }): ImageValidation {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, reason: 'type' };
  if (file.size > MAX_IMAGE_SIZE) return { ok: false, reason: 'size' };
  return { ok: true };
}

/**
 * Upload a base64 data URL to Cloudinary via the `cloudinary-upload` edge
 * function. Returns the stored asset's secure URL + public id, or null on
 * failure.
 */
export async function uploadPlayerImageToCloudinary(
  supabase: SupabaseLike,
  dataUrl: string,
  folder = 'players',
): Promise<UploadedImage | null> {
  const { data, error } = await supabase.functions.invoke('cloudinary-upload', {
    body: { file: dataUrl, folder },
  });

  if (error || !data?.secure_url) return null;

  return { url: data.secure_url, publicId: data.public_id ?? '' };
}

/** Delete an orphaned Cloudinary asset (best-effort). */
export async function destroyCloudinaryAsset(
  supabase: SupabaseLike,
  publicId: string,
): Promise<void> {
  await supabase.functions.invoke('cloudinary-upload', {
    body: { action: 'destroy', public_id: publicId },
  });
}

/**
 * True when a freshly uploaded asset replaces a different previous asset, so
 * the previous one should be removed from Cloudinary.
 */
export function shouldDestroyPreviousAsset(
  previousPublicId: string | null | undefined,
  newPublicId: string | null | undefined,
): boolean {
  return !!previousPublicId && previousPublicId !== newPublicId;
}
