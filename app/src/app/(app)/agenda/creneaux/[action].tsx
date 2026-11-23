import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { PastilleDeCreneau } from '@/components/pastille-de-creneau';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useEspaceSousOnglets } from '@/hooks/use-espace-sous-onglets';
import { confirmAction } from '@/lib/confirm';
import { libelleDeTranche } from '@/lib/creneaux';
import { formatDayLong } from '@/lib/format';
import { casesDuPole, useMonCreneau, usePlanningsOuverts, type PlanningOuvert } from '@/lib/mes-creneaux';
import { messageDuPlanning } from '@/lib/planning';
import { useTheme } from '@/theme';

type Choix = { pole: number; nomDuPole: string; heure: string; inscription: number | null };

/** Le planning d'une action ouverte aux membres : toucher un créneau libre, puis « Je prends ce créneau ». */
export default function CreneauxDeLActionScreen() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const plannings = usePlanningsOuverts();
  const planning = plannings.data?.find((p) => p.id === Number(action));

  let contenu;
  if (planning?.poles.length) contenu = <ChoixDuCreneau planning={planning} />;
  else if (plannings.isPending) contenu = <LoadingState />;
  else if (plannings.isError) contenu = <ErrorState onRetry={plannings.refetch} />;
  else if (planning) contenu = <EmptyState icon="calendar" title="Le planning n’est pas encore prêt" message="Le bureau prépare les créneaux : revenez un peu plus tard." />;
  else contenu = <EmptyState icon="calendar" title="Ce planning n’est plus ouvert" message="L’action est peut-être passée, ou le bureau l’a refermé." />;
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: planning?.titre ?? 'Planning' }} />
      {contenu}
    </>
  );
}

function ChoixDuCreneau({ planning }: { planning: PlanningOuvert }) {
  const { colors } = useTheme();
  const espaceSousOnglets = useEspaceSousOnglets();
  const [choix, setChoix] = useState<Choix | null>(null);
  const { prendre, liberer } = useMonCreneau();
  const erreur = prendre.error ?? liberer.error;

  // Un nouveau choix efface le message du précédent (« déjà inscrit à cette heure-là »).
  function choisir(c: Choix) {
    prendre.reset();
    liberer.reset();
    setChoix(c);
  }

  function prendreLeCreneau(c: Choix) {
    prendre.mutate({ pole: c.pole, heure: c.heure }, {
      onSuccess: () => {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setChoix(null);
      },
    });
  }
  async function libererLeCreneau(c: Choix) {
    const horaire = libelleDeTranche(c.heure, planning.duree_minutes);
    const ok = await confirmAction({ title: 'Vous ne pouvez plus venir ?', message: `${c.nomDuPole}, ${horaire}. Le bureau sera prévenu et la place redeviendra libre.`, confirmLabel: 'Me désinscrire', destructive: true });
    if (ok && c.inscription) liberer.mutate(c.inscription, { onSuccess: () => setChoix(null) });
  }

  return (
    <View style={[styles.ecran, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text variant="subhead" tone="secondary">{formatDayLong(planning.date)} · choisissez un créneau, il vous est réservé.</Text>
        {planning.poles.map((pole) => (
          <View key={pole.id} style={styles.pole}>
            <Text variant="headline">{pole.nom}</Text>
            <View style={styles.pastilles}>
              {casesDuPole(planning, pole).map((c) => (
                <PastilleDeCreneau key={c.heure} creneau={c} dureeMinutes={planning.duree_minutes}
                  estChoisi={choix?.pole === pole.id && choix.heure === c.heure}
                  onChoisir={() => choisir({ pole: pole.id, nomDuPole: pole.nom, heure: c.heure, inscription: c.inscription })} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.pied, { backgroundColor: colors.card, borderTopColor: colors.separator, paddingBottom: espaceSousOnglets }]}>
        {erreur && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(erreur)}</Text>}
        <ActionDuChoix choix={choix} dureeMinutes={planning.duree_minutes} enCours={prendre.isPending || liberer.isPending}
          onPrendre={prendreLeCreneau} onLiberer={libererLeCreneau} />
      </View>
    </View>
  );
}

type PropsDAction = { choix: Choix | null; dureeMinutes: number; enCours: boolean; onPrendre: (c: Choix) => void; onLiberer: (c: Choix) => void };

/** Le bouton du bas suit le créneau touché : le prendre, ou s'en désinscrire si c'est déjà le sien. */
function ActionDuChoix({ choix, dureeMinutes, enCours, onPrendre, onLiberer }: PropsDAction) {
  if (!choix) return <Text tone="secondary" style={styles.aide}>Touchez un créneau libre pour vous inscrire.</Text>;
  const horaire = `${choix.nomDuPole}, ${libelleDeTranche(choix.heure, dureeMinutes)}`;
  return (
    <>
      <Text variant="subhead" style={styles.aide}>{horaire}</Text>
      {choix.inscription
        ? <Button title="Je ne peux plus venir" variant="destructive" loading={enCours} onPress={() => onLiberer(choix)} />
        : <Button title="Je prends ce créneau" loading={enCours} onPress={() => onPrendre(choix)} />}
    </>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  contenu: { padding: 16, gap: 20, paddingBottom: 32 },
  pole: { gap: 10 },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pied: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  aide: { textAlign: 'center' },
});
