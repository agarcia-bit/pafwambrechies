import { EditForm } from '@/app/(app)/plus/admin/[collection]/edit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useCollection, type FormValues } from '@/lib/admin';
import { useMyFiche } from '@/lib/data';
import { useMember } from '@/lib/session';

// A member keeps their own directory entry up to date: photo, contact details, description.
// The first time, the form starts with what we already know about them.
export default function MaFicheScreen() {
  const c = useCollection('annuaire');
  const fiche = useMyFiche();
  const { profile } = useMember();
  if (!c) return <EmptyState title="Annuaire indisponible" />;
  if (fiche.isPending) return <LoadingState />;
  if (fiche.isError) return <ErrorState onRetry={fiche.refetch} />;

  const own = { memberId: profile.id, title: 'Ma fiche', submitLabel: 'Créer ma fiche' };
  if (fiche.data) return <EditForm key={fiche.data.id} collection={c} row={fiche.data as never} own={own} />;

  const starter: FormValues = {
    ...c.defaults(),
    prenom_contact: profile.prenom ?? '',
    nom_contact: profile.nom ?? '',
    email: profile.email ?? '',
  };
  return <EditForm collection={{ ...c, defaults: () => starter }} own={own} />;
}
