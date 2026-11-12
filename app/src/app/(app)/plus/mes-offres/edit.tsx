import { useLocalSearchParams } from 'expo-router';

import { EditionProposition } from '@/components/mes-propositions';
import { useMyFiche, useMyOffres } from '@/lib/data';
import { useMember } from '@/lib/session';

// Proposes an offer or edits one of the member's own proposals (it goes back to "en attente").
export default function MonOffreScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fiche = useMyFiche();
  const { profile } = useMember();
  return (
    <EditionProposition
      cle="offres"
      id={id}
      propositions={useMyOffres()}
      titreNouveau="Proposer une offre"
      // "Proposed by" starts with the member's directory name, then the name they gave.
      depart={(valeurs) => ({
        ...valeurs,
        commercant: fiche.data?.nom_entreprise ?? [profile.prenom, profile.nom].filter(Boolean).join(' '),
      })}
    />
  );
}
