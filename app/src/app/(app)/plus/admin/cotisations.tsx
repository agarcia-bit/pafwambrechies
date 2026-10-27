import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { ChipBar } from '@/components/ui/chip-bar';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { showMessage } from '@/lib/confirm';
import {
  STATUS_HUES,
  STATUS_LABELS,
  cotisationStatus,
  followingYear,
  needsRenewal,
  proposedEndDate,
  useClearCotisation,
  useCotisations,
  useSetCotisation,
  type CotisationRow,
} from '@/lib/cotisations';
import { formatDay, fullName } from '@/lib/format';
import { useTenantConfig } from '@/lib/tenant-config';
import { useTheme } from '@/theme';

const FILTERS = ['À renouveler', 'À jour', 'Tous'] as const;
type Filter = (typeof FILTERS)[number];

export default function CotisationsScreen() {
  const cotisations = useCotisations();
  const { refreshing, onRefresh } = usePullToRefresh(cotisations.refetch);
  const [filter, setFilter] = useState<Filter>('À renouveler');

  const rows = (cotisations.data ?? []).map((row) => ({ row, status: cotisationStatus(row.valide_jusqu) }));
  const toRenew = rows.filter((r) => needsRenewal(r.status)).length;
  const visible = rows.filter(
    (r) => filter === 'Tous' || (filter === 'À jour' ? !needsRenewal(r.status) : needsRenewal(r.status))
  );

  return (
    <FlatList
      data={visible}
      keyExtractor={(item) => item.row.id}
      renderItem={({ item }) => <MemberItem row={item.row} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          {cotisations.data && (
            <Text tone="secondary" style={styles.intro}>
              {rows.length - toRenew} à jour · {toRenew} à renouveler ou jamais réglée{toRenew > 1 ? 's' : ''}. Touchez un
              adhérent pour enregistrer son renouvellement.
            </Text>
          )}
          <ChipBar options={FILTERS} value={filter} onChange={setFilter} />
        </View>
      }
      ListEmptyComponent={
        cotisations.isPending ? (
          <LoadingState />
        ) : cotisations.isError ? (
          <ErrorState onRetry={cotisations.refetch} />
        ) : (
          <EmptyState
            icon="checkCircle"
            title={filter === 'À renouveler' ? 'Tout le monde est à jour' : 'Aucun adhérent'}
          />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function MemberItem({ row }: { row: CotisationRow }) {
  const { colors } = useTheme();
  const { cotisations } = useTenantConfig();
  const setCotisation = useSetCotisation();
  const clearCotisation = useClearCotisation();
  const status = cotisationStatus(row.valide_jusqu);
  const name = fullName(row.prenom, row.nom) || row.email || 'Adhérent';

  const fail = () => showMessage('Enregistrement impossible', 'La cotisation n’a pas pu être modifiée. Réessayez.');
  const record = (validUntil: string) => setCotisation.mutate({ memberId: row.id, validUntil }, { onError: fail });

  function choose() {
    const proposed = proposedEndDate(cotisations.echeance);
    Alert.alert(name, row.valide_jusqu ? `Cotisation valable jusqu’au ${formatDay(row.valide_jusqu)}.` : 'Aucune cotisation enregistrée.', [
      { text: `Renouvelée, jusqu’au ${formatDay(proposed)}`, onPress: () => record(proposed) },
      { text: `Jusqu’au ${formatDay(followingYear(proposed))}`, onPress: () => record(followingYear(proposed)) },
      ...(row.valide_jusqu
        ? [
            {
              text: 'Retirer la cotisation',
              style: 'destructive' as const,
              onPress: () => clearCotisation.mutate(row.id, { onError: fail }),
            },
          ]
        : []),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }

  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={`${name}, ${STATUS_LABELS[status]}`}
      onPress={choose}>
      <Avatar name={name} size={44} />
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          {row.valide_jusqu ? `Jusqu’au ${formatDay(row.valide_jusqu)}` : 'Aucune cotisation enregistrée'}
        </Text>
        <Badge label={STATUS_LABELS[status]} hue={STATUS_HUES[status]} />
      </View>
      <Icon name="chevron" size={14} color={colors.textSecondary} />
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 12 },
  intro: { marginHorizontal: 20 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  text: { flex: 1, gap: 4 },
  gap: { height: 8 },
});
