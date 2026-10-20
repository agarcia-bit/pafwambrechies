import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { adminErrorMessage } from '@/lib/admin';
import { confirmAction } from '@/lib/confirm';
import { daysUntil, formatDayShort, formatRelative, plural } from '@/lib/format';
import {
  sondageResults,
  useAdminSondages,
  useDeleteSondage,
  useSetSondageActif,
  type AdminSondages,
} from '@/lib/sondages';
import { useTheme } from '@/theme';

export default function SondageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAdminSondages();
  const sondage = data.data?.sondages.find((s) => s.id === Number(id));

  if (sondage && data.data) return <Results data={data.data} sondageId={sondage.id} />;
  if (data.isPending) return <LoadingState />;
  if (data.isError) return <ErrorState onRetry={data.refetch} />;
  return <EmptyState title="Sondage introuvable" message="Il a peut-être été supprimé." />;
}

function Results({ data, sondageId }: { data: AdminSondages; sondageId: number }) {
  const { colors } = useTheme();
  const setActif = useSetSondageActif();
  const remove = useDeleteSondage();
  const [error, setError] = useState<string | null>(null);
  const sondage = data.sondages.find((s) => s.id === sondageId)!;
  const results = sondageResults(sondage, data.members);
  const answered = new Set(sondage.sondage_reponses.map((r) => r.user_id));
  const waiting = data.members
    .filter((m) => !answered.has(m.id))
    .map((m) => [m.prenom, m.nom].filter(Boolean).join(' ') || 'Membre')
    .sort((a, b) => a.localeCompare(b));
  const total = sondage.sondage_reponses.length;

  async function toggle() {
    const closing = sondage.actif;
    const ok = await confirmAction({
      title: closing ? 'Clôturer le sondage ?' : 'Rouvrir le sondage ?',
      message: closing
        ? 'Il disparaît du fil des membres qui n’ont pas encore répondu. Les réponses sont conservées.'
        : 'Il revient en haut du fil des membres qui n’ont pas encore répondu.',
      confirmLabel: closing ? 'Clôturer' : 'Rouvrir',
    });
    if (ok) setActif.mutate({ id: sondageId, actif: !closing }, { onError: (e) => setError(adminErrorMessage(e)) });
  }

  async function destroy() {
    const ok = await confirmAction({
      title: 'Supprimer le sondage ?',
      message: 'Le sondage et toutes les réponses sont supprimés définitivement.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (ok) remove.mutate(sondageId, { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="title" selectable>
          {sondage.question}
        </Text>
        <Text variant="footnote" tone="secondary">
          Lancé {formatRelative(sondage.created_at).toLowerCase()} · {plural(total, 'réponse')} sur {data.members.length} membres
        </Text>
        <View style={styles.badges}>
          {sondage.obligatoire && <Badge label="Obligatoire" />}
          {!sondage.actif && <Badge label="Clôturé" />}
          {!!sondage.date_limite && (
            <Badge label={daysUntil(sondage.date_limite) < 0 ? `Terminé le ${formatDayShort(sondage.date_limite)}` : `Jusqu’au ${formatDayShort(sondage.date_limite)}`} />
          )}
        </View>
      </View>

      {results.map(({ option, count, voters }) => (
        <Card key={option.id} style={styles.card}>
          <View style={styles.optionHead}>
            <Text variant="headline" style={styles.flex}>
              {option.libelle}
            </Text>
            <Text variant="headline" tone="primary">
              {count}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.fill }]}>
            <View
              style={[styles.bar, { backgroundColor: colors.primary, width: `${total ? (count / total) * 100 : 0}%` }]}
            />
          </View>
          {voters.length > 0 && (
            <Text variant="footnote" tone="secondary">
              {voters.join(', ')}
            </Text>
          )}
        </Card>
      ))}

      {waiting.length > 0 && (
        <View style={styles.waiting}>
          <Text variant="headline">Pas encore répondu ({waiting.length})</Text>
          <Text variant="footnote" tone="secondary">
            {waiting.join(', ')}
          </Text>
        </View>
      )}

      {error && <Text tone="danger">{error}</Text>}
      <Button
        title={sondage.actif ? 'Clôturer le sondage' : 'Rouvrir le sondage'}
        variant="secondary"
        onPress={toggle}
        loading={setActif.isPending}
      />
      <Button title="Supprimer le sondage" variant="destructive" onPress={destroy} loading={remove.isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  head: { gap: 6, marginBottom: 4 },
  badges: { flexDirection: 'row', gap: 6 },
  card: { gap: 10 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  waiting: { gap: 4, marginVertical: 8 },
});
