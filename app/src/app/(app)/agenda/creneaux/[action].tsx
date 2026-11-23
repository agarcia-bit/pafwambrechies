import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { BilletDeCreneau } from '@/components/billet-de-creneau';
import { EchangesDuPlanning } from '@/components/echanges-du-planning';
import { PastilleDeCreneau } from '@/components/pastille-de-creneau';
import { PlacesAReprendre, useGestesDuBillet } from '@/components/places-a-reprendre';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useEspaceSousOnglets } from '@/hooks/use-espace-sous-onglets';
import { libelleDeTranche } from '@/lib/creneaux';
import { formatDayLong } from '@/lib/format';
import { billetsDuPlanning, casesDuPole, useMonCreneau, usePlanningsOuverts, type PlanningOuvert } from '@/lib/mes-creneaux';
import { messageDuPlanning } from '@/lib/planning';
import { useTheme } from '@/theme';

type Choix = { pole: number; nomDuPole: string; heure: string };

/** Le planning d'une action ouverte aux membres : toucher un créneau libre, puis « Je prends ce créneau ». */
export default function CreneauxDeLActionScreen() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const plannings = usePlanningsOuverts();
  const planning = plannings.data?.find((p) => p.id === Number(action));
  // Ouvert depuis une notification ou un lien : la liste gardée en mémoire peut dater d'avant
  // l'ouverture du planning. On la relit une fois avant de dire qu'il n'est plus ouvert.
  const dejaRelu = useRef(false);
  useEffect(() => {
    if (!plannings.data || planning || dejaRelu.current) return;
    dejaRelu.current = true;
    plannings.refetch();
  }, [plannings, planning]);

  let contenu;
  if (planning?.poles.length) contenu = <ChoixDuCreneau planning={planning} />;
  else if (plannings.isPending || (!planning && plannings.isFetching)) contenu = <LoadingState />;
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
  const [nouvelle, setNouvelle] = useState<number | null>(null);
  const { prendre, liberer } = useMonCreneau();
  const gestes = useGestesDuBillet(planning, (billet) => liberer.mutate(billet.inscription));
  const erreur = prendre.error ?? liberer.error ?? gestes.erreur;

  // Un nouveau choix efface le message du précédent (« déjà inscrit à cette heure-là »).
  function choisir(c: Choix) {
    prendre.reset();
    liberer.reset();
    setChoix(c);
  }
  function prendreLeCreneau(c: Choix) {
    prendre.mutate({ pole: c.pole, heure: c.heure }, {
      onSuccess: (inscription) => {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNouvelle(inscription);
        setChoix(null);
      },
    });
  }
  function reprendreLaPlace(inscription: number) {
    gestes.reprendre.mutate(inscription, {
      onSuccess: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
    });
  }

  const billets = billetsDuPlanning(planning);
  return (
    <View style={[styles.ecran, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text variant="subhead" tone="secondary">{formatDayLong(planning.date)}</Text>
        {billets.map((billet) => (
          <BilletDeCreneau key={billet.inscription} nomDuPole={billet.nomDuPole} heure={billet.heure} dureeMinutes={planning.duree_minutes}
            autres={billet.autres} estNouveau={billet.inscription === nouvelle} enCours={liberer.isPending || gestes.enCours}
            onLiberer={() => gestes.nePlusVenir(billet)} remplacantRecherche={billet.remplacantRecherche}
            onPartager={() => gestes.partager(billet)} onRevenir={() => gestes.revenir(billet)}
            onEchanger={() => router.push({ pathname: '/agenda/creneaux/echange', params: { action: String(planning.id), inscription: String(billet.inscription) } })} />
        ))}
        <EchangesDuPlanning planning={planning} />
        <PlacesAReprendre planning={planning} enCours={gestes.enCours} onReprendre={reprendreLaPlace} />
        <Text variant="headline">{billets.length ? 'Donner encore un coup de main' : 'Choisissez votre créneau'}</Text>
        {planning.poles.map((pole) => {
          const cases = casesDuPole(planning, pole).filter((c) => c.etat !== 'vous');
          if (!cases.length) return null;
          return (
            <View key={pole.id} style={styles.pole}>
              <Text variant="footnote" tone="secondary" style={styles.nomDuPole}>{pole.nom.toUpperCase()}</Text>
              <View style={styles.pastilles}>
                {cases.map((c) => (
                  <PastilleDeCreneau key={c.heure} creneau={c} dureeMinutes={planning.duree_minutes}
                    estChoisi={choix?.pole === pole.id && choix.heure === c.heure}
                    onChoisir={() => choisir({ pole: pole.id, nomDuPole: pole.nom, heure: c.heure })} />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.pied, { backgroundColor: colors.card, borderTopColor: colors.separator, paddingBottom: espaceSousOnglets }]}>
        {erreur && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(erreur)}</Text>}
        <ActionDuChoix choix={choix} dureeMinutes={planning.duree_minutes} enCours={prendre.isPending} onPrendre={prendreLeCreneau} />
      </View>
    </View>
  );
}

type PropsDAction = { choix: Choix | null; dureeMinutes: number; enCours: boolean; onPrendre: (c: Choix) => void };

/** Le bouton du bas suit le créneau touché ; ses propres créneaux se libèrent depuis leur billet. */
function ActionDuChoix({ choix, dureeMinutes, enCours, onPrendre }: PropsDAction) {
  if (!choix) return <Text tone="secondary" style={styles.aide}>Touchez un créneau libre pour vous inscrire.</Text>;
  return (
    <>
      <Text variant="subhead" style={styles.aide}>{choix.nomDuPole}, {libelleDeTranche(choix.heure, dureeMinutes)}</Text>
      <Button title="Je prends ce créneau" loading={enCours} onPress={() => onPrendre(choix)} />
    </>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  contenu: { padding: 16, gap: 16, paddingBottom: 32 },
  pole: { gap: 8 },
  nomDuPole: { fontWeight: '600', letterSpacing: 0.5 },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pied: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  aide: { textAlign: 'center' },
});
