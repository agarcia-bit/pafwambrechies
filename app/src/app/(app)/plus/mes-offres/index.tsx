import { ListeDePropositions } from '@/components/mes-propositions';
import { useMyOffres } from '@/lib/data';
import { offerValidity } from '@/lib/format';

// The offers the member proposed: a proposal is published by the bureau after a check.
export default function MesOffresScreen() {
  return (
    <ListeDePropositions
      propositions={useMyOffres()}
      cheminEdition="/plus/mes-offres/edit"
      proposer="Proposer une offre"
      intro="Proposez une offre aux adhérents. Elle est publiée après validation par le bureau."
      icone="tag"
      vide="Aucune offre proposée"
      sousTitre={(offre) => offerValidity(offre.expiration)}
    />
  );
}
