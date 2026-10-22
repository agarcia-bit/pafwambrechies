import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { useBlocked, useUnblock } from '@/lib/moderation';

// The members the signed-in member has blocked, with a way to unblock them.
export default function BloquesScreen() {
  const blocked = useBlocked();
  const unblock = useUnblock();

  if (blocked.isPending) return <LoadingState />;
  if (blocked.isError) return <ErrorState onRetry={blocked.refetch} />;
  return (
    <FlatList
      data={blocked.data}
      keyExtractor={(b) => b.blocked_id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListEmptyComponent={
        <EmptyState icon="block" title="Aucun membre bloqué" message="Les membres que vous bloquez apparaissent ici." />
      }
      renderItem={({ item }) => (
        <Card style={styles.row}>
          <Avatar name={item.nom} size={40} round />
          <Text variant="headline" style={styles.name} numberOfLines={1}>
            {item.nom || 'Membre'}
          </Text>
          <Button
            compact
            variant="secondary"
            title="Débloquer"
            loading={unblock.isPending && unblock.variables === item.blocked_id}
            onPress={() =>
              unblock.mutate(item.blocked_id, {
                onError: () => showMessage('Déblocage impossible', 'Vérifiez votre connexion et réessayez.'),
              })
            }
          />
        </Card>
      )}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1 },
  gap: { height: 8 },
});
