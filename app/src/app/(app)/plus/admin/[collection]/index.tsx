import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableCard } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { findCollection, useAdminList, type Collection, type Row } from '@/lib/admin';
import { useTheme } from '@/theme';

export default function AdminListScreen() {
  const { collection } = useLocalSearchParams<{ collection: string }>();
  const c = findCollection(collection);
  if (!c) return <EmptyState title="Section inconnue" />;
  return <AdminList collection={c} />;
}

function AdminList({ collection: c }: { collection: Collection }) {
  const list = useAdminList(c);
  const { refreshing, onRefresh } = usePullToRefresh(list.refetch);
  const add = () => router.push({ pathname: '/plus/admin/[collection]/edit', params: { collection: c.key } });

  return (
    <>
      <Stack.Screen
        options={{
          title: c.title,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={c.addLabel} hitSlop={10} onPress={add}>
              <Icon name="plus" size={22} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={list.data ?? []}
        keyExtractor={(row) => String(row.id)}
        renderItem={({ item }) => <AdminRow collection={c} row={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={<Button title={c.addLabel} icon="plus" variant="secondary" onPress={add} style={styles.add} />}
        ListEmptyComponent={
          list.isPending ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState onRetry={list.refetch} />
          ) : (
            <EmptyState icon={c.icon} title={c.empty} />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </>
  );
}

function AdminRow({ collection: c, row }: { collection: Collection; row: Row }) {
  const { colors } = useTheme();
  const { title, subtitle, image, flag } = c.describe(row);
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={`Modifier ${title}`}
      onPress={() =>
        router.push({ pathname: '/plus/admin/[collection]/edit', params: { collection: c.key, id: String(row.id) } })
      }>
      {image !== undefined && <Avatar name={title} uri={image} size={44} />}
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="footnote" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
        {flag && <Badge label={flag} />}
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
  add: { marginHorizontal: 16, marginBottom: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowText: { flex: 1, gap: 3 },
  gap: { height: 8 },
});
