import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { todayISO } from '@/lib/format';
import { getPushStatus, shouldOfferPush } from '@/lib/notifications';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Actu, Commentaire, Commercant, Evenement, Idee, Lien, Offre } from '@/lib/types';

// Every read below is scoped to the member's association by the RLS policies.

const PAGE_SIZE = 10;

function unwrap<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

// Likes and comments work the same way on actus and ideas. The comment author
// separators match what the web app has always stored in each table.
const SOCIAL = {
  actu: { list: 'actus', likes: 'actus_likes', comments: 'actus_commentaires', column: 'actu_id', separator: ' ' },
  idee: { list: 'idees', likes: 'idees_likes', comments: 'idees_commentaires', column: 'idee_id', separator: ' - ' },
} as const;
export type SocialKind = keyof typeof SOCIAL;

const ACTU_FIELDS =
  'id, titre, date, categorie, excerpt, contenu, actus_likes(count), actus_commentaires(count), my_like:actus_likes(user_id)';
const IDEE_FIELDS =
  'id, user_id, prenom, categorie, titre, texte, created_at, idees_likes(count), idees_commentaires(count), my_like:idees_likes(user_id)';

/** An item already loaded in one of the infinite lists (instant detail screen). */
function findInLists<T extends { id: number }>(client: QueryClient, list: string, id: number): T | undefined {
  for (const [, data] of client.getQueriesData<InfiniteData<T[]>>({ queryKey: [list] })) {
    const found = data?.pages.flat().find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

// ── Actus ────────────────────────────────────────────────────────────────────

export function useActus(category: string) {
  const { profile } = useMember();
  return useInfiniteQuery({
    queryKey: ['actus', category],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('actus')
        .select(ACTU_FIELDS)
        .eq('my_like.user_id', profile.id)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1);
      if (category !== 'Tous') query = query.eq('categorie', category);
      return unwrap<Actu[]>(await query);
    },
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length : undefined),
  });
}

export function useActu(id: number) {
  const { profile } = useMember();
  const client = useQueryClient();
  return useQuery({
    queryKey: ['actu', id],
    queryFn: async () =>
      unwrap<Actu | null>(
        await supabase.from('actus').select(ACTU_FIELDS).eq('id', id).eq('my_like.user_id', profile.id).maybeSingle()
      ),
    placeholderData: () => findInLists<Actu>(client, 'actus', id),
  });
}

// ── Ideas ────────────────────────────────────────────────────────────────────

export function useIdees() {
  const { profile } = useMember();
  return useInfiniteQuery({
    queryKey: ['idees'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap<Idee[]>(
        await supabase
          .from('idees')
          .select(IDEE_FIELDS)
          .eq('visible', true)
          .eq('my_like.user_id', profile.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1)
      ),
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length : undefined),
  });
}

export function useIdee(id: number) {
  const { profile } = useMember();
  const client = useQueryClient();
  return useQuery({
    queryKey: ['idee', id],
    queryFn: async () =>
      unwrap<Idee | null>(
        await supabase.from('idees').select(IDEE_FIELDS).eq('id', id).eq('my_like.user_id', profile.id).maybeSingle()
      ),
    placeholderData: () => findInLists<Idee>(client, 'idees', id),
  });
}

export function useCreateIdee() {
  const { profile } = useMember();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (idee: { titre: string; categorie: string; texte: string }) => {
      const { error } = await supabase.from('idees').insert({
        ...idee,
        user_id: profile.id,
        prenom: authorName(profile, SOCIAL.idee.separator),
        tenant_id: profile.tenant_id,
      });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['idees'] }),
  });
}

// ── Likes and comments ───────────────────────────────────────────────────────

function authorName(
  profile: { prenom: string | null; nom: string | null; email: string | null },
  separator: string
): string {
  const name = [profile.prenom, profile.nom].map((p) => p?.trim()).filter(Boolean).join(separator);
  return name || profile.email?.split('@')[0] || 'Anonyme';
}

export function useToggleLike(kind: SocialKind, id: number) {
  const { profile } = useMember();
  const client = useQueryClient();
  const { likes, column, list } = SOCIAL[kind];
  return useMutation({
    // `count` is the value shown when pressed, for the optimistic display.
    mutationFn: async ({ liked }: { liked: boolean; count: number }) => {
      const { error } = liked
        ? await supabase.from(likes).delete().eq(column, id).eq('user_id', profile.id)
        : await supabase.from(likes).insert({ [column]: id, user_id: profile.id, tenant_id: profile.tenant_id });
      if (error) throw error;
    },
    // Returning the refetch keeps the mutation pending until the new counts
    // arrive, so the optimistic state never flickers back.
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: [list] }),
        client.invalidateQueries({ queryKey: [kind, id] }),
      ]),
  });
}

export function useComments(kind: SocialKind, parentId: number) {
  const { comments, column } = SOCIAL[kind];
  return useQuery({
    queryKey: ['comments', kind, parentId],
    queryFn: async () =>
      unwrap<Commentaire[]>(
        await supabase
          .from(comments)
          .select('id, user_id, prenom, texte, created_at')
          .eq(column, parentId)
          .order('created_at')
      ),
  });
}

export function useCommentMutations(kind: SocialKind, parentId: number) {
  const { profile } = useMember();
  const client = useQueryClient();
  const { comments, column, list, separator } = SOCIAL[kind];
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['comments', kind, parentId] }),
      client.invalidateQueries({ queryKey: [list] }),
      client.invalidateQueries({ queryKey: [kind, parentId] }),
    ]);

  const add = useMutation({
    mutationFn: async (texte: string) => {
      const { error } = await supabase.from(comments).insert({
        [column]: parentId,
        user_id: profile.id,
        prenom: authorName(profile, separator),
        texte,
        tenant_id: profile.tenant_id,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (commentId: number) => {
      const { error } = await supabase.from(comments).delete().eq('id', commentId);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  return { add, remove };
}

// ── Directory, offers, events, links ────────────────────────────────────────

export function useAnnuaire() {
  return useQuery({
    queryKey: ['annuaire'],
    queryFn: async () => unwrap<Commercant[]>(await supabase.from('annuaire').select('*').order('nom_entreprise')),
  });
}

/** Offers still valid today (or without an end date), ending soonest first. */
export function useOffres() {
  return useQuery({
    queryKey: ['offres'],
    queryFn: async () =>
      unwrap<Offre[]>(
        await supabase
          .from('offres')
          .select('*')
          .or(`expiration.gte.${todayISO()},expiration.is.null`)
          .order('expiration', { ascending: true, nullsFirst: false })
      ),
  });
}

export function useEvenements() {
  return useQuery({
    queryKey: ['evenements'],
    queryFn: async () =>
      unwrap<Evenement[]>(
        await supabase.from('evenements').select('*').gte('date', todayISO()).order('date').order('heure')
      ),
  });
}

export function useLiens() {
  return useQuery({
    queryKey: ['liens'],
    queryFn: async () => unwrap<Lien[]>(await supabase.from('liens').select('*').order('created_at')),
  });
}

// ── Notifications ────────────────────────────────────────────────────────────

export function usePushStatus() {
  return useQuery({ queryKey: ['push-status'], queryFn: getPushStatus, staleTime: 0 });
}

export function usePushOffer() {
  return useQuery({ queryKey: ['push-offer'], queryFn: shouldOfferPush, staleTime: 0 });
}
