import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  campaignOf,
  campaignOpen,
  cotisationStatus,
  needsRenewal,
  proposedEndDate,
  useClearCotisation,
  useCotisations,
  useSetCotisation,
  type Campaign,
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

  const config = useTenantConfig().cotisations;
  const campaign = campaignOf(config);
  const rows = (cotisations.data ?? []).map((row) => ({ row, status: cotisationStatus(row.valide_jusqu, campaign) }));
  const toRenew = rows.filter((r) => needsRenewal(r.status)).length;
  const visible = rows.filter(
    (r) => filter === 'Tous' || (filter === 'À jour' ? !needsRenewal(r.status) : needsRenewal(r.status))
  );

  return (
    <FlatList
      data={visible}
      keyExtractor={(item) => item.row.id}
      renderItem={({ item }) => <MemberItem row={item.row} campaign={campaign} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          {cotisations.data && (
            <Text tone="secondary" style={styles.intro}>
              {rows.length - toRenew} à jour · {toRenew} à renouveler. Touchez un adhérent pour enregistrer son
              renouvellement.
            </Text>
          )}
          <Text variant="footnote" tone="secondary" style={styles.intro}>
            {campaign
              ? campaignOpen(campaign)
                ? `Campagne ${campaign.libelle || ''} ouverte depuis le ${formatDay(campaign.ouverture)} : les adhérents concernés voient un bandeau et reçoivent une notification par semaine jusqu’au ${formatDay(campaign.fin)}.`
                : `Campagne ${campaign.libelle || ''} : ouverture le ${formatDay(campaign.ouverture)}, valable jusqu’au ${formatDay(campaign.fin)}.`
              : 'Aucune campagne en cours : aucun rappel n’est envoyé. Lancez-en une pour demander le renouvellement.'}
          </Text>
          <Button
            title="Campagne et lien de paiement"
            icon="gear"
            variant="secondary"
            onPress={() => router.push('/plus/admin/cotisations-reglages')}
            style={styles.setup}
          />
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

function MemberItem({ row, campaign }: { row: CotisationRow; campaign: Campaign | null }) {
  const { colors } = useTheme();
  const setCotisation = useSetCotisation();
  const clearCotisation = useClearCotisation();
  const status = cotisationStatus(row.valide_jusqu, campaign);
  const name = fullName(row.prenom, row.nom) || row.email || 'Adhérent';

  const fail = () => showMessage('Enregistrement impossible', 'La cotisation n’a pas pu être modifiée. Réessayez.');
  const record = (validUntil: string) => setCotisation.mutate({ memberId: row.id, validUntil }, { onError: fail });

  function choose() {
    const proposed = proposedEndDate(campaign);
    Alert.alert(name, row.valide_jusqu ? `Cotisation valable jusqu’au ${formatDay(row.valide_jusqu)}.` : 'Aucune cotisation enregistrée.', [
      { text: `Renouvelée, jusqu’au ${formatDay(proposed)}`, onPress: () => record(proposed) },
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
  setup: { marginHorizontal: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  text: { flex: 1, gap: 4 },
  gap: { height: 8 },
});
