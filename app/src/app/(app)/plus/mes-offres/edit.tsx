import { useLocalSearchParams } from 'expo-router';

import { EditForm } from '@/app/(app)/plus/admin/[collection]/edit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useCollection, type FormValues } from '@/lib/admin';
import { useMyFiche, useMyOffres } from '@/lib/data';
import { useMember } from '@/lib/session';

// Proposes an offer or edits one of the member's own proposals (it goes back to "en attente").
export default function MonOffreScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useCollection('offres');
  const offres = useMyOffres();
  const fiche = useMyFiche();
  const { profile } = useMember();
  if (!c) return <EmptyState title="Offres indisponibles" />;

  const own = {
    memberId: profile.id,
    title: id ? 'Ma proposition' : 'Proposer une offre',
    hideFields: ['statut'],
    canDelete: true,
    submitLabel: 'Envoyer pour validation',
  };

  if (id) {
    if (offres.isPending) return <LoadingState />;
    if (offres.isError) return <ErrorState onRetry={offres.refetch} />;
    const row = offres.data?.find((o) => o.id === Number(id));
    if (!row) return <EmptyState title="Proposition introuvable" message="Elle a peut-être été supprimée." />;
    return <EditForm key={row.id} collection={c} row={row as never} own={own} />;
  }

  // "Proposed by" starts with the member's directory name, then the name they gave.
  const starter: FormValues = {
    ...c.defaults(),
    commercant: fiche.data?.nom_entreprise ?? [profile.prenom, profile.nom].filter(Boolean).join(' '),
  };
  return <EditForm collection={{ ...c, defaults: () => starter }} own={own} />;
}
