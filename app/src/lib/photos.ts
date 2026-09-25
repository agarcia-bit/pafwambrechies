import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedPhoto = { uri: string; base64: string };

/**
 * Lets the admin pick a photo, then crops its center to 4:3 at 800×600 like
 * the web app (the iOS picker can only crop squares). Null when cancelled.
 */
export async function pickDirectoryPhoto(): Promise<PickedPhoto | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  if (picked.canceled) return null;

  const image = await ImageManipulator.manipulate(picked.assets[0].uri).renderAsync();
  let width = image.width;
  let height = Math.round((width * 3) / 4);
  if (height > image.height) {
    height = image.height;
    width = Math.round((height * 4) / 3);
  }
  const cropped = await ImageManipulator.manipulate(image)
    .crop({
      originX: Math.round((image.width - width) / 2),
      originY: Math.round((image.height - height) / 2),
      width,
      height,
    })
    .resize({ width: 800 })
    .renderAsync();
  const saved = await cropped.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Photo illisible');
  return { uri: saved.uri, base64: saved.base64 };
}

/** Uploads to the public annuaire-photos bucket (admins only) and returns its URL. */
export async function uploadDirectoryPhoto(photo: PickedPhoto): Promise<string> {
  const bytes = Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0));
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const bucket = supabase.storage.from('annuaire-photos');
  const { error } = await bucket.upload(path, bytes.buffer, { contentType: 'image/jpeg' });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
