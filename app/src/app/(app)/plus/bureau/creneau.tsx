import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Compteur } from '@/components/ui/compteur';
import { Icon } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { confirmAction } from '@/lib/confirm';
import { besoinDuCreneau, estDejaPrisALHeure, libelleDeTranche } from '@/lib/creneaux';
import { inscritsDuCreneau, messageDuPlanning, useModifierLePlanning, usePlanning, type Inscrit } from '@/lib/planning';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

/** Un créneau d'un pôle (« Gaufres, 10 h – 12 h ») : combien il faut de monde, qui vient, ajouter un nom. */
export default function CreneauScreen() {
  const { action, pole: poleId, heure } = useLocalSearchParams<{ action: string; pole: string; heure: string }>();
  const planning = usePlanning(Number(action));
  const modification = useModifierLePlanning(Number(action));
  const pole = planning.data?.poles.find((p) => p.id === Number(poleId));
  const { profile } = useMember();

  if (planning.isPending) return <LoadingState />;
  if (planning.isError) return <ErrorState onRetry={planning.refetch} />;
  if (!pole || !planning.data.horaires) return <EmptyState title="Créneau introuvable" message="Le pôle a peut-être été supprimé." />;
  const inscrits = inscritsDuCreneau(planning.data, pole.id, heure);
  return (
    <>
      <Stack.Screen options={{ title: `${pole.nom} · ${libelleDeTranche(heure, planning.data.horaires.dureeMinutes)}` }} />
      <FormScreen>
        {modification.isError && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(modification.error)}</Text>}
        <View style={styles.ligne}>
          <Text>Personnes nécessaires</Text>
          <Compteur libelle="personnes nécessaires sur ce créneau" valeur={besoinDuCreneau(pole, heure)}
            onChanger={(besoin) => modification.mutate({ type: 'besoin', pole, heure, besoin })} />
        </View>
        <ListeDesInscrits inscrits={inscrits} moi={profile.id} onRetirer={(inscrit) => modification.mutate(
          inscrit.membre === profile.id ? { type: 'je-me-retire', inscrit } : { type: 'retirer', inscrit })} />
        {inscrits.length < besoinDuCreneau(pole, heure) && !estDejaPrisALHeure(planning.data.inscrits, profile.id, heure) && (
          <Button title="Je viens" icon="plus" loading={modification.isPending} onPress={() => modification.mutate({ type: 'je-viens', pole, heure, moi: profile.id })} />
        )}
        {inscrits.length < besoinDuCreneau(pole, heure) && (
          <AjoutDUnNom enCours={modification.isPending} onAjouter={(nom) => modification.mutate({ type: 'ajouter-nom', pole, heure, nom })} />
        )}
      </FormScreen>
    </>
  );
}

function ListeDesInscrits({ inscrits, moi, onRetirer }: { inscrits: Inscrit[]; moi: string; onRetirer: (inscrit: Inscrit) => void }) {
  const { colors } = useTheme();
  async function retirer(inscrit: Inscrit) {
    const estMoi = inscrit.membre === moi;
    const titre = estMoi ? 'Vous ne pouvez plus venir ?' : `Retirer ${inscrit.nom} de ce créneau ?`;
    if (await confirmAction({ title: titre, confirmLabel: estMoi ? 'Me désinscrire' : 'Retirer', destructive: true })) onRetirer(inscrit);
  }
  if (!inscrits.length) return <Text tone="secondary">Personne pour l’instant.</Text>;
  return (
    <ListSection title="Qui vient">
      {inscrits.map((inscrit) => (
        <ListRow
          key={inscrit.id}
          icon="person"
          title={inscrit.membre === moi ? 'Vous' : inscrit.nom}
          subtitle={inscrit.a_compte ? 'Inscrit depuis l’app' : 'Ajouté à la main'}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${inscrit.nom}`} onPress={() => retirer(inscrit)} style={styles.retirer}>
              <Icon name="close" size={18} color={colors.danger} />
            </Pressable>
          }
        />
      ))}
    </ListSection>
  );
}

/** Ajouter quelqu'un à la main : sans l'app, ou inscrit de vive voix. */
function AjoutDUnNom({ enCours, onAjouter }: { enCours: boolean; onAjouter: (nom: string) => void }) {
  const [nom, setNom] = useState('');
  function ajouter() {
    if (!nom.trim()) return;
    onAjouter(nom);
    setNom('');
  }
  return (
    <View style={styles.ajout}>
      <TextField label="Ajouter quelqu’un" value={nom} onChangeText={setNom} placeholder="Prénom Nom" autoCapitalize="words" returnKeyType="done" onSubmitEditing={ajouter} />
      <Button title="Ajouter" icon="plus" variant="secondary" disabled={!nom.trim()} loading={enCours} onPress={ajouter} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Le compteur sous son libellé, à gauche : sur l'iPhone Duo fermé, le bord droit d'une feuille
  // peut passer sous l'heure à la première ouverture.
  ligne: { gap: 8, alignItems: 'flex-start' },
  ajout: { gap: 10 },
  retirer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
