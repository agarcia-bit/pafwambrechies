import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon?: IconName; title: string; message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      {icon && <Icon name={icon} size={40} color={colors.textSecondary} />}
      <Text variant="headline" style={styles.centerText}>
        {title}
      </Text>
      {message && (
        <Text variant="subhead" tone="secondary" style={styles.centerText}>
          {message}
        </Text>
      )}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="headline" style={styles.centerText}>
        Impossible de charger
      </Text>
      <Text variant="subhead" tone="secondary" style={styles.centerText}>
        Vérifiez votre connexion internet.
      </Text>
      <Button title="Réessayer" variant="secondary" onPress={onRetry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, minHeight: 240 },
  centerText: { textAlign: 'center' },
  retry: { marginTop: 12 },
});
