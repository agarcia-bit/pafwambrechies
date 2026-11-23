import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ChoiceField, DateField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { showMessage } from '@/lib/confirm';
import { usePropositionsAValider, useRepondreALaProposition, type Devenir } from '@/lib/evenements-proposes';
import { LIBELLE_DU_TYPE, quandEtOu } from '@/lib/evenements-proposes-regles';

const DEVENIRS: Record<Devenir, string> = { evenement: 'Un événement de l’Agenda', action: 'Une action du Pilotage' };

/**
 * Répondre à une proposition, depuis le Pilotage de l'app. Accepter : son événement est publié dans
 * l'Agenda (toutes ses séances) ; une proposition à organiser devient un événement de l'Agenda ou
 * une action du Pilotage, à la date choisie. Ne pas retenir : un mot facultatif part au membre.
 */
export default function PropositionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const propositions = usePropositionsAValider();
  const repondre = useRepondreALaProposition();
  const [devenir, setDevenir] = useState<Devenir>('evenement');
  const [date, setDate] = useState('');
  const [mot, setMot] = useState('');
  const p = propositions.data?.find((x) => x.id === Number(id));
  if (propositions.isPending) return <LoadingState />;
  if (!p) return <EmptyState icon="checkCircle" title="Déjà traitée" message="Le bureau a déjà répondu à cette proposition." />;
  const aOrganiser = p.type === 'a_organiser';
  const prenom = p.auteur_nom?.split(' ')[0] ?? 'le membre';

  function envoyer(accepter: boolean) {
    repondre.mutate(accepter ? { proposition: p!, accepter, devenir, date: aOrganiser ? date : null } : { proposition: p!, accepter, mot }, {
      onSuccess: () => {
        router.back();
        showMessage(accepter ? (aOrganiser && devenir === 'action' ? 'Ajoutée au Pilotage' : 'Publiée dans l’Agenda') : 'Réponse envoyée', `${prenom} sera prévenu de votre réponse.`);
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: p.titre }} />
      <FormScreen>
        <Text variant="footnote" tone="secondary">{LIBELLE_DU_TYPE[p.type]} · proposé par {p.auteur_nom ?? 'un membre'}</Text>
        <Text variant="headline">{quandEtOu(p)}</Text>
        <Text selectable>{p.description}</Text>
        {aOrganiser && (
          <>
            <Text variant="footnote" tone="secondary">{p.soutiens ? `${p.soutiens} membre${p.soutiens > 1 ? 's soutiennent' : ' soutient'} cette idée.` : 'Personne ne soutient encore cette idée.'}</Text>
            <ChoiceField label="En faire" options={Object.keys(DEVENIRS)} value={devenir} format={(d) => DEVENIRS[d as Devenir]} onChange={(d) => setDevenir(d as Devenir)} />
            <DateField label="Date" value={date} optional={false} onChange={setDate} />
          </>
        )}
        <Button title={aOrganiser ? 'Accepter' : 'Publier dans l’Agenda'} icon="check" loading={repondre.isPending && repondre.variables?.accepter}
          disabled={repondre.isPending || (aOrganiser && !date)} onPress={() => envoyer(true)} />
        <TextField label={`Si vous ne retenez pas : un mot pour ${prenom} (facultatif)`} value={mot} onChangeText={setMot} multiline maxLength={500}
          placeholder="Ex : merci, mais la salle n’est pas libre ce mois-ci." />
        <Button title="Ne pas retenir" variant="secondary" loading={repondre.isPending && !repondre.variables?.accepter}
          disabled={repondre.isPending} onPress={() => envoyer(false)} />
        {repondre.isError && <Text tone="danger" accessibilityLiveRegion="polite">{repondre.error.message}</Text>}
      </FormScreen>
    </>
  );
}
