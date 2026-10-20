import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedPhoto = { uri: string; base64: string; width: number; height: number };

/**
 * Lets the admin pick a photo and prepares it for upload as a JPEG.
 *  - crop (directory entries, shown as 4:3): the center is cut to 4:3;
 *  - no crop (posts): the whole photo is kept, in its own format.
 * It is only ever made smaller: at most `outputWidth` wide and 1.5 times that tall.
 * Null when cancelled.
 */
export async function pickPhoto({ outputWidth = 800, crop = true } = {}): Promise<PickedPhoto | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  if (picked.canceled) return null;

  const image = await ImageManipulator.manipulate(picked.assets[0].uri).renderAsync();
  let context = ImageManipulator.manipulate(image);
  let { width, height } = image;
  if (crop) {
    width = image.width;
    height = Math.round((width * 3) / 4);
    if (height > image.height) {
      height = image.height;
      width = Math.round((height * 4) / 3);
    }
    context = context.crop({
      originX: Math.round((image.width - width) / 2),
      originY: Math.round((image.height - height) / 2),
      width,
      height,
    });
  }
  const scale = Math.min(1, outputWidth / width, (outputWidth * 1.5) / height);
  const rendered = await context.resize({ width: Math.round(width * scale) }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Photo illisible');
  return { uri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height };
}

/** Width / height of a photo uploaded by uploadPhoto (it is in the file name), if known. */
export function photoRatio(url: string): number | null {
  const match = url.match(/-(\d{2,5})x(\d{2,5})\.jpg(?:\?|$)/);
  return match ? Number(match[1]) / Number(match[2]) : null;
}

/** Uploads to a public photo bucket (admins only) and returns the photo's URL. */
export async function uploadPhoto(photo: PickedPhoto, bucketName: string): Promise<string> {
  const bytes = Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0));
  // The size goes in the name so that screens know the photo's format before loading it.
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${photo.width}x${photo.height}.jpg`;
  const bucket = supabase.storage.from(bucketName);
  const { error } = await bucket.upload(path, bytes.buffer, { contentType: 'image/jpeg' });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
