import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceField, TimeField } from '@/components/form-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Compteur } from '@/components/ui/compteur';
import { Icon } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { confirmAction } from '@/lib/confirm';
import {
  besoinDuCreneau, DUREES_DE_TRANCHE, etatPourLeBureau, libelleDeTranche, minutesDe, tranchesDeLaJournee,
  type Horaires, type Pole,
} from '@/lib/creneaux';
import { inscritsDuCreneau, type Planning, type useModifierLePlanning } from '@/lib/planning';
import { useTheme } from '@/theme';

type Modifier = ReturnType<typeof useModifierLePlanning>['mutate'];

const HORAIRES_PROPOSES: Horaires = { debut: '10:00', fin: '18:00', dureeMinutes: 120 };
const libelleDeDuree = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ' 30' : ''}`);

/** Pas encore de planning : à quoi il sert, et des horaires proposés. */
export function DemarrerLePlanning({ modifier }: { modifier: Modifier }) {
  return (
    <View style={styles.bloc}>
      <Text tone="secondary">Besoin de bras le jour J ? Découpez la journée en créneaux, ajoutez les pôles (stand, buvette…), puis ouvrez le planning aux membres pour qu’ils s’inscrivent depuis l’app.</Text>
      <Button title="Préparer un planning" icon="plus" onPress={() => modifier({ type: 'horaires', horaires: HORAIRES_PROPOSES })} />
    </View>
  );
}

export function ReglagesDuPlanning({ horaires, modifier }: { horaires: Horaires; modifier: Modifier }) {
  const [brouillon, setBrouillon] = useState(horaires);
  const estModifie = brouillon.debut !== horaires.debut || brouillon.fin !== horaires.fin;
  const estValide = minutesDe(brouillon.fin) - minutesDe(brouillon.debut) >= brouillon.dureeMinutes;
  return (
    <View style={styles.bloc}>
      <View style={styles.deuxColonnes}>
        <View style={styles.colonne}><TimeField label="De" value={brouillon.debut} onChange={(debut) => setBrouillon({ ...brouillon, debut })} /></View>
        <View style={styles.colonne}><TimeField label="À" value={brouillon.fin} onChange={(fin) => setBrouillon({ ...brouillon, fin })} /></View>
      </View>
      {estModifie && !estValide && <Text tone="danger">L’heure de fin doit laisser la place à au moins un créneau.</Text>}
      {estModifie && <Button title="Enregistrer les horaires" disabled={!estValide} onPress={() => modifier({ type: 'horaires', horaires: brouillon })} />}
      <ChoiceField
        label="Créneaux de"
        options={DUREES_DE_TRANCHE.map(String)}
        value={String(horaires.dureeMinutes)}
        format={(option) => libelleDeDuree(Number(option))}
        onChange={(option) => modifier({ type: 'horaires', horaires: { ...horaires, dureeMinutes: Number(option) } })}
      />
    </View>
  );
}

export function PolesDuPlanning({ poles, modifier }: { poles: Pole[]; modifier: Modifier }) {
  const [nom, setNom] = useState('');
  function ajouter() {
    if (!nom.trim()) return;
    modifier({ type: 'ajouter-pole', nom, personnes: 1, ordre: poles.length });
    setNom('');
  }
  return (
    <View style={styles.bloc}>
      <Text variant="headline">Pôles</Text>
      {poles.map((pole) => <LigneDePole key={pole.id} pole={pole} modifier={modifier} />)}
      {!poles.length && <Text tone="secondary">Aucun pôle : ajoutez-en un (stand, gaufres, café…).</Text>}
      <TextField label="Nouveau pôle" value={nom} onChangeText={setNom} placeholder="Ex. Buvette" returnKeyType="done" onSubmitEditing={ajouter} />
      {nom.trim() !== '' && <Button title="Ajouter le pôle" icon="plus" variant="secondary" onPress={ajouter} />}
    </View>
  );
}

function LigneDePole({ pole, modifier }: { pole: Pole; modifier: Modifier }) {
  const { colors } = useTheme();
  const [nom, setNom] = useState(pole.nom);
  async function supprimer() {
    const ok = await confirmAction({ title: `Supprimer « ${pole.nom} » ?`, message: 'Ses inscriptions seront aussi supprimées.', confirmLabel: 'Supprimer', destructive: true });
    if (ok) modifier({ type: 'supprimer-pole', pole });
  }
  return (
    <View style={[styles.pole, { backgroundColor: colors.card }]}>
      <View style={styles.poleHaut}>
        <View style={styles.colonne}>
          <TextField label="Nom du pôle" value={nom} onChangeText={setNom} onEndEditing={() => nom.trim() && nom !== pole.nom && modifier({ type: 'modifier-pole', pole, changement: { nom: nom.trim() } })} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Supprimer le pôle ${pole.nom}`} onPress={supprimer} style={styles.corbeille}>
          <Icon name="trash" size={20} color={colors.danger} />
        </Pressable>
      </View>
      <View style={styles.poleBas}>
        <Text tone="secondary" style={styles.colonne}>Personnes en même temps</Text>
        <Compteur libelle={`personnes en même temps pour ${pole.nom}`} valeur={pole.personnes} onChanger={(personnes) => modifier({ type: 'modifier-pole', pole, changement: { personnes } })} />
      </View>
    </View>
  );
}

/** La grille sur téléphone : une section par pôle, une ligne par tranche ; toucher une ligne ouvre le créneau. */
export function GrilleDuPlanning({ actionId, moi, planning }: { actionId: number; moi: string; planning: Planning & { horaires: Horaires } }) {
  const { colors } = useTheme();
  const tranches = tranchesDeLaJournee(planning.horaires);
  const teinte = { rempli: colors.success, manque: colors.warning, ferme: undefined } as const;
  return planning.poles.map((pole) => (
    <ListSection key={pole.id} title={pole.nom}>
      {tranches.map((heure) => {
        const inscrits = inscritsDuCreneau(planning, pole.id, heure);
        const besoin = besoinDuCreneau(pole, heure);
        const etat = etatPourLeBureau(besoin, inscrits.length);
        const manque = besoin - inscrits.length;
        const detail = inscrits.length ? inscrits.map((i) => (i.membre === moi ? 'Vous' : i.nom)).join(', ') : besoin ? `Il manque ${manque} personne${manque > 1 ? 's' : ''}` : 'Pas besoin';
        return (
          <ListRow
            key={heure}
            title={libelleDeTranche(heure, planning.horaires.dureeMinutes)}
            subtitle={detail}
            right={<Badge label={besoin ? `${inscrits.length}/${besoin}` : '—'} hue={teinte[etat]} />}
            accessibilityHint="Ouvre le créneau pour ajouter ou retirer quelqu’un"
            onPress={() => router.push({ pathname: '/plus/bureau/creneau', params: { action: String(actionId), pole: String(pole.id), heure } })}
          />
        );
      })}
    </ListSection>
  ));
}

const styles = StyleSheet.create({
  bloc: { gap: 12 },
  deuxColonnes: { flexDirection: 'row', gap: 12 },
  colonne: { flex: 1 },
  pole: { borderRadius: 16, padding: 12, gap: 8 },
  poleHaut: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  poleBas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  corbeille: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
