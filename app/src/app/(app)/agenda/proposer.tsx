import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { DateField, ChoiceField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { showMessage } from '@/lib/confirm';
import { todayISO } from '@/lib/format';
import { useProposerUnEvenement } from '@/lib/evenements-proposes';
import { erreurDeLaProposition, resumeDesSeances, seancesDeLaSerie, type ChampsDeProposition, type Repetition, type TypeDeProposition } from '@/lib/evenements-proposes-regles';

const TYPES: Record<TypeDeProposition, string> = { a_organiser: 'À organiser avec le bureau', personnel: 'Mon événement' };
const REPETITIONS: Record<Repetition, string> = { aucune: 'Une seule fois', semaine: 'Chaque semaine', mois: 'Chaque mois' };
const VIDE: ChampsDeProposition = { type: 'a_organiser', titre: '', description: '', periode: '', date: '', heure: '', lieu: '', repetition: 'aucune', nbMois: 3 };

/**
 * « Proposer un événement », depuis l'Agenda. À organiser avec le bureau : il devient aussi une
 * idée que les autres peuvent soutenir. Mon événement (une soirée karaoké, un atelier…) : après
 * l'accord du bureau, il paraît dans l'Agenda avec toutes ses séances.
 */
export default function ProposerScreen() {
  const proposer = useProposerUnEvenement();
  const [champs, setChamps] = useState<ChampsDeProposition>(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const changer = (changement: Partial<ChampsDeProposition>) => setChamps((avant) => ({ ...avant, ...changement }));
  const estPersonnel = champs.type === 'personnel';

  function envoyer() {
    const probleme = erreurDeLaProposition(champs, todayISO());
    setErreur(probleme);
    if (probleme) return;
    proposer.mutate(champs, {
      onSuccess: () => {
        router.back();
        showMessage('Merci !', estPersonnel ? 'Le bureau va regarder votre événement. Vous serez prévenu de sa réponse.' : 'Votre proposition est aussi dans la boîte à idées : les autres membres peuvent la soutenir.');
      },
      onError: (e) => setErreur(e.message.startsWith('Vous avez') || e.message.startsWith('La date') ? e.message : 'La proposition n’a pas pu partir. Vérifiez votre connexion.'),
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} /> }} />
      <FormScreen>
        <ChoiceField label="C’est…" options={Object.keys(TYPES)} value={champs.type} format={(t) => TYPES[t as TypeDeProposition]}
          onChange={(t) => changer({ type: t as TypeDeProposition })} />
        <Text variant="footnote" tone="secondary">
          {estPersonnel
            ? 'Un événement que vous organisez vous-même et que vous voulez faire connaître aux membres.'
            : 'Une idée d’événement que l’association pourrait organiser. Le bureau choisira la date.'}
        </Text>
        <TextField label="Nom de l’événement" value={champs.titre} onChangeText={(titre) => changer({ titre })}
          placeholder={estPersonnel ? 'Ex : Soirée karaoké' : 'Ex : Vide-grenier de printemps'} maxLength={120} />
        {estPersonnel ? <QuandEtOu champs={champs} changer={changer} />
          : <TextField label="Quand ? (facultatif)" value={champs.periode} onChangeText={(periode) => changer({ periode })} placeholder="Ex : courant mars, un samedi" maxLength={120} />}
        <TextField label="Description" value={champs.description} onChangeText={(description) => changer({ description })}
          placeholder="Ce qu’on y fait, pour qui, ce qu’il faut prévoir…" multiline maxLength={2000} />
        {erreur && <Text tone="danger" accessibilityLiveRegion="polite">{erreur}</Text>}
        <Button title="Envoyer au bureau" icon="send" onPress={envoyer} loading={proposer.isPending} />
      </FormScreen>
    </>
  );
}

type PropsDeQuand = { champs: ChampsDeProposition; changer: (changement: Partial<ChampsDeProposition>) => void };

/** Mon événement : la date, l'heure, le lieu et la répétition, avec les séances qui en découlent. */
function QuandEtOu({ champs, changer }: PropsDeQuand) {
  const seances = champs.date ? seancesDeLaSerie(champs.date, champs.repetition, champs.nbMois) : [];
  return (
    <>
      <DateField label="Date (la première, s’il y en a plusieurs)" value={champs.date} optional={false} onChange={(date) => changer({ date })} />
      <TextField label="Heure (facultatif)" value={champs.heure} onChangeText={(heure) => changer({ heure })} placeholder="Ex : 20 h" maxLength={40} />
      <TextField label="Lieu" value={champs.lieu} onChangeText={(lieu) => changer({ lieu })} placeholder="Ex : Bar du Centre, Wambrechies" maxLength={200} />
      <ChoiceField label="Se répète" options={Object.keys(REPETITIONS)} value={champs.repetition} format={(r) => REPETITIONS[r as Repetition]}
        onChange={(r) => changer({ repetition: r as Repetition })} />
      {champs.repetition !== 'aucune' && (
        <ChoiceField label="Pendant" options={['3', '6']} value={String(champs.nbMois)} format={(n) => `${n} mois`}
          onChange={(n) => changer({ nbMois: Number(n) as 3 | 6 })} />
      )}
      {seances.length > 1 && <Text variant="footnote" tone="secondary">{resumeDesSeances(seances)}</Text>}
    </>
  );
}
