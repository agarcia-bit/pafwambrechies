import type { UseQueryResult } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EditForm } from '@/app/(app)/plus/admin/[collection]/edit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableCard } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useCollection, type Collection, type FormValues } from '@/lib/admin';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

// Ce qu'un adhérent propose (offres, actus) : la liste de ses propositions et leur formulaire.
// Une proposition n'est visible de tous qu'après validation par le bureau.

type Proposition = { id: number; titre: string; statut?: string };

export function ListeDePropositions<T extends Proposition>({
  propositions,
  cheminEdition,
  proposer,
  intro,
  icone,
  vide,
  sousTitre,
}: {
  propositions: UseQueryResult<T[]>;
  cheminEdition: '/plus/mes-offres/edit' | '/plus/mes-actus/edit';
  /** « Proposer une offre » */
  proposer: string;
  intro: string;
  icone: IconName;
  vide: string;
  sousTitre: (proposition: T) => string;
}) {
  const { refreshing, onRefresh } = usePullToRefresh(propositions.refetch);
  const ouvrirFormulaire = () => router.push(cheminEdition as Href);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={proposer} hitSlop={10} onPress={ouvrirFormulaire}>
              <Icon name="plus" size={22} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={propositions.data ?? []}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <LigneProposition proposition={item} sousTitre={sousTitre(item)} cheminEdition={cheminEdition} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Espace}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text tone="secondary" style={styles.intro}>
              {intro}
            </Text>
            <Button title={proposer} icon="plus" variant="secondary" onPress={ouvrirFormulaire} style={styles.add} />
          </View>
        }
        ListEmptyComponent={
          propositions.isPending ? (
            <LoadingState />
          ) : propositions.isError ? (
            <ErrorState onRetry={propositions.refetch} />
          ) : (
            <EmptyState icon={icone} title={vide} message="Vos propositions apparaîtront ici." />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </>
  );
}

function LigneProposition({
  proposition,
  sousTitre,
  cheminEdition,
}: {
  proposition: Proposition;
  sousTitre: string;
  cheminEdition: string;
}) {
  const { colors } = useTheme();
  const enAttente = proposition.statut === 'en_attente';
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={proposition.titre}
      onPress={() => router.push({ pathname: cheminEdition, params: { id: String(proposition.id) } } as Href)}>
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={2}>
          {proposition.titre}
        </Text>
        <Text variant="footnote" tone="secondary">
          {sousTitre}
        </Text>
        <View style={styles.badges}>
          <Badge label={enAttente ? 'En attente de validation' : 'Publiée'} />
        </View>
      </View>
      <Icon name="chevron" size={14} color={colors.textSecondary} />
    </PressableCard>
  );
}

function Espace() {
  return <View style={styles.gap} />;
}

/**
 * Le formulaire d'une proposition : nouvelle, ou l'une des siennes (elle repasse alors en attente).
 * `modifiable` dit si l'adhérent peut encore y toucher (une actu publiée ne se modifie plus).
 */
export function EditionProposition({
  cle,
  id,
  propositions,
  titreNouveau,
  depart,
  modifiable = () => true,
}: {
  cle: Collection['key'];
  id?: string;
  propositions: UseQueryResult<Proposition[]>;
  titreNouveau: string;
  /** Les valeurs de départ d'une nouvelle proposition, quand elles diffèrent de celles du bureau. */
  depart?: (valeurs: FormValues) => FormValues;
  modifiable?: (proposition: Proposition) => boolean;
}) {
  const collection = useCollection(cle);
  const { profile } = useMember();
  if (!collection) return <EmptyState title="Indisponible" />;

  const own = {
    memberId: profile.id,
    title: id ? 'Ma proposition' : titreNouveau,
    hideFields: ['statut'],
    canDelete: true,
    submitLabel: 'Envoyer pour validation',
  };
  if (!id) {
    const valeurs = depart ? depart(collection.defaults()) : collection.defaults();
    return <EditForm collection={{ ...collection, defaults: () => valeurs }} own={own} />;
  }
  if (propositions.isPending) return <LoadingState />;
  if (propositions.isError) return <ErrorState onRetry={propositions.refetch} />;
  const proposition = propositions.data?.find((p) => p.id === Number(id));
  if (!proposition) return <EmptyState title="Proposition introuvable" message="Elle a peut-être été supprimée." />;
  if (!modifiable(proposition)) {
    return <EmptyState icon="checkCircle" title="Déjà publiée" message="Pour la modifier, contactez le bureau." />;
  }
  return <EditForm key={proposition.id} collection={collection} row={proposition as never} own={own} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 16 },
  intro: { marginHorizontal: 20 },
  add: { marginHorizontal: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  gap: { height: 8 },
});
