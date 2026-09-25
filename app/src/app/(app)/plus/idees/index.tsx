import { router, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { IdeeCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useIdees } from '@/lib/data';

export default function IdeesScreen() {
  const idees = useIdees();
  const { refreshing, onRefresh } = usePullToRefresh(idees.refetch);
  const items = idees.data?.pages.flat() ?? [];
  const propose = () => router.push('/plus/idees/nouvelle');

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Proposer une idée" hitSlop={10} onPress={propose}>
              <Icon name="plus" size={22} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <IdeeCard idee={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text tone="secondary">
              Une idée pour l’association ? Proposez-la, les adhérents peuvent la soutenir et la commenter.
            </Text>
            <Button title="Proposer une idée" icon="plus" variant="secondary" onPress={propose} />
          </View>
        }
        ListEmptyComponent={
          idees.isPending ? (
            <LoadingState />
          ) : idees.isError ? (
            <ErrorState onRetry={idees.refetch} />
          ) : (
            <EmptyState icon="lightbulb" title="Aucune idée pour le moment" message="Soyez le premier à en proposer une !" />
          )
        }
        ListFooterComponent={idees.isFetchingNextPage ? <ActivityIndicator style={styles.more} /> : null}
        onEndReached={() => {
          if (idees.hasNextPage && !idees.isFetchingNextPage) idees.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  header: { gap: 12, marginHorizontal: 16, marginBottom: 16 },
  gap: { height: 12 },
  more: { marginTop: 16 },
});
