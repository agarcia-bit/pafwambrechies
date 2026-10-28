import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';

import { showMessage } from '@/lib/confirm';
import { openLink } from '@/lib/links';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// The association's documents (supabase/documents.sql): files in a private bucket, opened through
// a short-lived signed link. The bureau adds and removes them, every member reads them.

export type Doc = {
  id: number;
  titre: string;
  categorie: string | null;
  path: string;
  nom_fichier: string;
  mime: string | null;
  taille: number | null;
  created_at: string;
};

const BUCKET = 'documents';
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const SIGNED_LINK_SECONDS = 60 * 60;

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async (): Promise<Doc[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, titre, categorie, path, nom_fichier, mime, taille, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });
}

/** "2,4 Mo", "340 Ko". */
export function fileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export async function openDocument(doc: Doc): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.path, SIGNED_LINK_SECONDS);
  if (error || !data) return showMessage('Document introuvable', 'Réessayez dans un instant.');
  await openLink(data.signedUrl);
}

export type PickedDocument = { uri: string; name: string; mime: string | null; size: number | null };

/** Lets the bureau choose a file on the phone. Null when cancelled. */
export async function pickDocument(): Promise<PickedDocument | null> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const a = picked.assets[0];
  return { uri: a.uri, name: a.name, mime: a.mimeType ?? null, size: a.size ?? null };
}

// File names travel in a storage path: keep them plain.
function safeName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(-80) || 'document';
}

export type NewDocument = { titre: string; categorie: string; file: PickedDocument };

export function useAddDocument() {
  const client = useQueryClient();
  const { profile } = useMember();
  return useMutation({
    mutationFn: async ({ titre, categorie, file }: NewDocument) => {
      const bytes = await (await fetch(file.uri)).arrayBuffer();
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error('too_large');
      const path = `${profile.tenant_id}/${Date.now()}-${safeName(file.name)}`;
      const bucket = supabase.storage.from(BUCKET);
      const upload = await bucket.upload(path, bytes, { contentType: file.mime ?? 'application/octet-stream' });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from('documents').insert({
        titre: titre.trim(),
        categorie: categorie.trim() || null,
        path,
        nom_fichier: file.name,
        mime: file.mime,
        taille: bytes.byteLength,
      });
      if (error) {
        await bucket.remove([path]);
        throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useRemoveDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (doc: Doc) => {
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      // The row is gone for everybody; a leftover file is only unreachable clutter.
      await supabase.storage.from(BUCKET).remove([doc.path]);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['documents'] }),
  });
}
