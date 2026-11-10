import { useLocalSearchParams } from 'expo-router';

import { EditionProposition } from '@/components/mes-propositions';
import { useMesActus } from '@/lib/data';

// Propose une actu, ou modifie une de ses propositions tant que le bureau ne l'a pas publiée.
export default function MonActuScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <EditionProposition
      cle="actus"
      id={id}
      propositions={useMesActus()}
      titreNouveau="Proposer une actu"
      modifiable={(actu) => actu.statut === 'en_attente'}
    />
  );
}
