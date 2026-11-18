import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { Zone } from '@/lib/recadrage';
import { supabase } from '@/lib/supabase';

export type PickedPhoto = { uri: string; base64: string; width: number; height: number; png?: boolean };

/** Une photo choisie dans la galerie, pas encore préparée : `image` a déjà le bon sens (EXIF). */
export type PhotoChoisie = { uri: string; image: ImageRef; largeur: number; hauteur: number };

/** Ouvre la galerie ; null si la personne annule. */
export async function choisirPhoto(): Promise<PhotoChoisie | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  if (picked.canceled) return null;
  const uri = picked.assets[0].uri;
  const image = await ImageManipulator.manipulate(uri).renderAsync();
  return { uri, image, largeur: image.width, hauteur: image.height };
}

/**
 * Prepares a chosen photo for upload as a JPEG.
 *  - `zone` (directory entries, framed by the member): exactly that part of the photo;
 *  - crop without zone: the center is cut to 4:3;
 *  - no crop (posts): the whole photo is kept, in its own format;
 *  - 'logo' (association logo): the center is cut square and kept as a PNG (transparency stays).
 * It is only ever made smaller: at most `outputWidth` wide and 1.5 times that tall.
 */
export async function preparerPhoto(
  photo: PhotoChoisie,
  { outputWidth = 800, crop = true, zone }: { outputWidth?: number; crop?: boolean | 'logo'; zone?: Zone } = {}
): Promise<PickedPhoto> {
  const { image } = photo;
  let context = ImageManipulator.manipulate(image);
  let { width, height } = image;
  const cadrage = zone ?? (crop ? zoneCentree(image.width, image.height, crop === 'logo' ? 1 : 4 / 3) : null);
  if (cadrage) {
    width = cadrage.largeur;
    height = cadrage.hauteur;
    context = context.crop({ originX: cadrage.x, originY: cadrage.y, width, height });
  }
  const scale = Math.min(1, outputWidth / width, (outputWidth * 1.5) / height);
  const rendered = await context.resize({ width: Math.round(width * scale) }).renderAsync();
  const png = crop === 'logo';
  const saved = await rendered.saveAsync({ format: png ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('Photo illisible');
  return { uri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height, png };
}

/** Choisit puis prépare une photo, sans recadrage à la main (actus, logo). Null si annulé. */
export async function pickPhoto(options: { outputWidth?: number; crop?: boolean | 'logo' } = {}): Promise<PickedPhoto | null> {
  const photo = await choisirPhoto();
  return photo ? preparerPhoto(photo, options) : null;
}

/** Le plus grand rectangle au format `ratio`, au centre de la photo. */
function zoneCentree(largeurImage: number, hauteurImage: number, ratio: number): Zone {
  const largeur = Math.min(largeurImage, Math.round(hauteurImage * ratio));
  const hauteur = Math.min(hauteurImage, Math.round(largeur / ratio));
  return { x: Math.round((largeurImage - largeur) / 2), y: Math.round((hauteurImage - hauteur) / 2), largeur, hauteur };
}

/** Width / height of a photo uploaded by uploadPhoto (it is in the file name), if known. */
export function photoRatio(url: string): number | null {
  const match = url.match(/-(\d{2,5})x(\d{2,5})\.jpg(?:\?|$)/);
  return match ? Number(match[1]) / Number(match[2]) : null;
}

/** Uploads a photo and returns its public URL; `folder` puts it in a sub-folder of the bucket. */
export async function uploadPhoto(photo: PickedPhoto, bucketName: string, folder?: string): Promise<string> {
  const bytes = Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0));
  // The size goes in the name so that screens know the photo's format before loading it.
  const ext = photo.png ? 'png' : 'jpg';
  const path = `${folder ? `${folder}/` : ''}${Date.now()}-${Math.random().toString(36).slice(2)}-${photo.width}x${photo.height}.${ext}`;
  const bucket = supabase.storage.from(bucketName);
  const { error } = await bucket.upload(path, bytes.buffer, { contentType: photo.png ? 'image/png' : 'image/jpeg' });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
