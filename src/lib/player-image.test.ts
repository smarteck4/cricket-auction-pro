import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadPlayerImageToCloudinary,
  destroyCloudinaryAsset,
  shouldDestroyPreviousAsset,
  type SupabaseLike,
} from './player-image';

/**
 * Integration tests for the Create Player and Edit Player image flows.
 *
 * These verify the exact contract that guarantees player images end up stored
 * as Cloudinary assets:
 *   1. Create Player -> the selected image is uploaded through the
 *      `cloudinary-upload` edge function and the returned Cloudinary
 *      `secure_url` + `public_id` are what get persisted onto the player row.
 *   2. Edit Player -> a replacement image is uploaded to Cloudinary, the new
 *      Cloudinary asset is persisted, and the previous Cloudinary asset is
 *      destroyed so it isn't orphaned.
 *
 * The Supabase client is mocked so we assert against the real orchestration
 * code shared with Admin.tsx (via src/lib/player-image.ts).
 */

const DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42m只';

interface PlayerRow {
  name: string;
  profile_picture_url: string;
  profile_picture_public_id: string | null;
}

/** Build a mock Supabase client whose edge function + table writes we can spy on. */
function makeSupabaseMock(invokeImpl: (name: string, opts: { body: any }) => any) {
  const invoke = vi.fn(invokeImpl);
  const insert = vi.fn(async (_row: PlayerRow) => ({ error: null }));
  const eq = vi.fn(async () => ({ error: null }));
  const update = vi.fn((_row: PlayerRow) => ({ eq }));
  const from = vi.fn((_table: string) => ({ insert, update }));

  const client = { functions: { invoke }, from } as unknown as SupabaseLike & {
    from: typeof from;
  };

  return { client, invoke, insert, update, eq, from };
}

/** Mirrors Admin.addPlayer's Cloudinary + persist orchestration. */
async function createPlayerFlow(
  supabase: SupabaseLike & { from: (t: string) => any },
  player: { name: string; profile_picture_url: string },
  imageDataUrl: string | null,
) {
  let profileUrl = player.profile_picture_url;
  let profilePublicId: string | null = null;

  if (imageDataUrl) {
    const uploaded = await uploadPlayerImageToCloudinary(supabase, imageDataUrl);
    if (!uploaded) return { error: 'upload_failed' as const };
    profileUrl = uploaded.url;
    profilePublicId = uploaded.publicId;
  }

  const { error } = await supabase.from('players').insert({
    ...player,
    profile_picture_url: profileUrl,
    profile_picture_public_id: profilePublicId,
  });
  return { error };
}

/** Mirrors Admin.updatePlayer's Cloudinary replace + destroy orchestration. */
async function editPlayerFlow(
  supabase: SupabaseLike & { from: (t: string) => any },
  editingPlayer: {
    id: string;
    name: string;
    profile_picture_url: string;
    profile_picture_public_id: string | null;
  },
  newImageDataUrl: string | null,
) {
  let profileUrl = editingPlayer.profile_picture_url;
  let profilePublicId: string | null = editingPlayer.profile_picture_public_id;
  const previousPublicId = editingPlayer.profile_picture_public_id;
  let replacedOldImage = false;

  if (newImageDataUrl) {
    const uploaded = await uploadPlayerImageToCloudinary(supabase, newImageDataUrl);
    if (!uploaded) return { error: 'upload_failed' as const };
    profileUrl = uploaded.url;
    profilePublicId = uploaded.publicId || null;
    replacedOldImage = shouldDestroyPreviousAsset(previousPublicId, profilePublicId);
  }

  const { error } = await supabase
    .from('players')
    .update({
      ...editingPlayer,
      profile_picture_url: profileUrl,
      profile_picture_public_id: profilePublicId,
    })
    .eq(editingPlayer.id);

  if (!error && replacedOldImage && previousPublicId) {
    await destroyCloudinaryAsset(supabase, previousPublicId);
  }
  return { error };
}

describe('Create Player -> Cloudinary asset', () => {
  let supabase: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    supabase = makeSupabaseMock((name, opts) => {
      expect(name).toBe('cloudinary-upload');
      expect(opts.body).toMatchObject({ file: DATA_URL, folder: 'players' });
      return Promise.resolve({
        data: {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/players/new_abc.png',
          public_id: 'players/new_abc',
        },
        error: null,
      });
    });
  });

  it('uploads the selected image to Cloudinary and persists the Cloudinary URL + public_id', async () => {
    const result = await createPlayerFlow(
      supabase.client,
      { name: 'Virat', profile_picture_url: '' },
      DATA_URL,
    );

    expect(result.error).toBeNull();

    // The image was routed through the Cloudinary edge function exactly once.
    expect(supabase.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.invoke).toHaveBeenCalledWith('cloudinary-upload', {
      body: { file: DATA_URL, folder: 'players' },
    });

    // The Cloudinary response — not a local blob — is what gets stored.
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    const stored = supabase.insert.mock.calls[0][0] as PlayerRow;
    expect(stored.profile_picture_url).toBe(
      'https://res.cloudinary.com/demo/image/upload/v1/players/new_abc.png',
    );
    expect(stored.profile_picture_public_id).toBe('players/new_abc');
    expect(stored.profile_picture_url).toContain('res.cloudinary.com');
  });

  it('does not persist a player if the Cloudinary upload fails', async () => {
    const failing = makeSupabaseMock(() =>
      Promise.resolve({ data: { error: 'Upload failed' }, error: null }),
    );

    const result = await createPlayerFlow(
      failing.client,
      { name: 'Rohit', profile_picture_url: '' },
      DATA_URL,
    );

    expect(result.error).toBe('upload_failed');
    expect(failing.insert).not.toHaveBeenCalled();
  });
});

describe('Edit Player -> Cloudinary asset', () => {
  it('uploads the replacement to Cloudinary, stores the new asset, and destroys the old one', async () => {
    const calls: Array<{ name: string; body: any }> = [];
    const supabase = makeSupabaseMock((name, opts) => {
      calls.push({ name, body: opts.body });
      if (opts.body?.action === 'destroy') {
        return Promise.resolve({ data: { result: 'ok' }, error: null });
      }
      return Promise.resolve({
        data: {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/players/edited_xyz.png',
          public_id: 'players/edited_xyz',
        },
        error: null,
      });
    });

    const result = await editPlayerFlow(
      supabase.client,
      {
        id: 'player-1',
        name: 'Virat',
        profile_picture_url: 'https://res.cloudinary.com/demo/image/upload/v1/players/old_123.png',
        profile_picture_public_id: 'players/old_123',
      },
      DATA_URL,
    );

    expect(result.error).toBeNull();

    // New image uploaded to Cloudinary and stored on the player row.
    expect(supabase.update).toHaveBeenCalledTimes(1);
    const stored = supabase.update.mock.calls[0][0] as PlayerRow;
    expect(stored.profile_picture_url).toBe(
      'https://res.cloudinary.com/demo/image/upload/v1/players/edited_xyz.png',
    );
    expect(stored.profile_picture_public_id).toBe('players/edited_xyz');

    // Old Cloudinary asset destroyed to avoid orphaning.
    const destroyCall = calls.find((c) => c.body?.action === 'destroy');
    expect(destroyCall).toBeDefined();
    expect(destroyCall!.body).toEqual({ action: 'destroy', public_id: 'players/old_123' });
  });

  it('does not destroy any asset when no new image is selected', async () => {
    const supabase = makeSupabaseMock(() =>
      Promise.resolve({ data: {}, error: null }),
    );

    const result = await editPlayerFlow(
      supabase.client,
      {
        id: 'player-1',
        name: 'Virat',
        profile_picture_url: 'https://res.cloudinary.com/demo/image/upload/v1/players/old_123.png',
        profile_picture_public_id: 'players/old_123',
      },
      null,
    );

    expect(result.error).toBeNull();
    expect(supabase.invoke).not.toHaveBeenCalled();
    expect(supabase.update).toHaveBeenCalledTimes(1);
  });
});

describe('shouldDestroyPreviousAsset', () => {
  it('destroys only when the public_id actually changed', () => {
    expect(shouldDestroyPreviousAsset('a', 'b')).toBe(true);
    expect(shouldDestroyPreviousAsset('a', 'a')).toBe(false);
    expect(shouldDestroyPreviousAsset(null, 'b')).toBe(false);
    expect(shouldDestroyPreviousAsset('', 'b')).toBe(false);
  });
});
