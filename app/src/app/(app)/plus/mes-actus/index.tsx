import { ListeDePropositions } from '@/components/mes-propositions';
import { useMesActus } from '@/lib/data';
import { formatDay } from '@/lib/format';

// Les actus que l'adhérent a proposées : le bureau les publie après relecture.
export default function MesActusScreen() {
  return (
    <ListeDePropositions
      propositions={useMesActus()}
      cheminEdition="/plus/mes-actus/edit"
      proposer="Proposer une actu"
      intro="Une nouvelle, un événement, une réussite à partager ? Proposez une actu : elle est publiée après validation par le bureau."
      icone="newspaper"
      vide="Aucune actu proposée"
      sousTitre={(actu) => `${formatDay(actu.date)} · ${actu.categorie}`}
    />
  );
}
