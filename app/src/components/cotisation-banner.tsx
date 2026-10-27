import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import {
  STATUS_LABELS,
  cotisationStatus,
  describeStatus,
  needsRenewal,
  useMyCotisation,
  type CotisationStatus,
} from '@/lib/cotisations';
import { useTenantConfig } from '@/lib/tenant-config';
import { useTheme } from '@/theme';

/** Opens the association's payment page (HelloAsso, ...) in the browser. */
function openPaymentPage(url: string) {
  Linking.openURL(url).catch(() => showMessage('Lien impossible à ouvrir', 'Réessayez ou contactez le bureau.'));
}

/**
 * Paying happens on the association's own page, outside the app: nothing is locked, and the
 * bureau updates the status afterwards. The details say so, with the payment button when due.
 */
function showDetails(
  status: CotisationStatus,
  validUntil: string | null | undefined,
  config: { url: string; montant: string }
) {
  const { title, message } = describeStatus(status, validUntil);
  const canPay = needsRenewal(status) && !!config.url;
  const lines = [message];
  if (needsRenewal(status) && config.montant) lines.push(`Montant : ${config.montant}.`);
  lines.push(
    canPay
      ? 'Le paiement se fait sur le site de l’association ; le bureau met ensuite à jour votre statut.'
      : needsRenewal(status)
        ? 'Rapprochez-vous du bureau pour régler votre cotisation.'
        : ''
  );
  Alert.alert(title, lines.filter(Boolean).join('\n\n'), [
    ...(canPay ? [{ text: 'Régler en ligne', onPress: () => openPaymentPage(config.url) }] : []),
    { text: 'Fermer', style: 'cancel' as const },
  ]);
}

/** "Ma cotisation" row of the Plus tab: the member's status, and the payment page when one is due. */
export function CotisationRow() {
  const { cotisations } = useTenantConfig();
  const mine = useMyCotisation();
  if (!cotisations.enabled) return null;
  const status = mine.data === undefined ? null : cotisationStatus(mine.data);

  return (
    <ListRow
      icon="card"
      title="Ma cotisation"
      subtitle={status ? STATUS_LABELS[status] : undefined}
      onPress={status ? () => showDetails(status, mine.data, cotisations) : undefined}
    />
  );
}

/**
 * Thin red strip at the top of the home feed while the member's dues are missing or about to
 * end, like a pending poll: it stays until the bureau records the renewal.
 */
export function CotisationBanner() {
  const { cotisations } = useTenantConfig();
  const mine = useMyCotisation();
  const { colors } = useTheme();
  if (!cotisations.enabled || mine.isPending || mine.isError) return null;

  const status = cotisationStatus(mine.data);
  if (!needsRenewal(status)) return null;
  const { title } = describeStatus(status, mine.data);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Affiche le détail et le lien de paiement"
      onPress={() => showDetails(status, mine.data, cotisations)}
      style={({ pressed }) => [styles.strip, { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.row}>
        <Icon name="card" size={18} color="#FFFFFF" />
        <Text variant="subhead" style={styles.label}>
          {title}
        </Text>
      </View>
      <Icon name="chevron" size={13} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  label: { color: '#FFFFFF', fontWeight: '700' },
});
