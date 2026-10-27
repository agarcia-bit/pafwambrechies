import { Alert, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { STATUS_LABELS, cotisationStatus, describeStatus, needsRenewal, useMyCotisation } from '@/lib/cotisations';
import { useTenantConfig } from '@/lib/tenant-config';
import { useTheme } from '@/theme';

/** Opens the association's payment page (HelloAsso, ...) in the browser. */
export function openPaymentPage(url: string) {
  Linking.openURL(url).catch(() => showMessage('Lien impossible à ouvrir', 'Réessayez ou contactez le bureau.'));
}

/** "Ma cotisation" row of the Plus tab: the member's status, and the payment page when one is due. */
export function CotisationRow() {
  const { cotisations } = useTenantConfig();
  const mine = useMyCotisation();
  if (!cotisations.enabled) return null;

  const status = mine.data === undefined ? null : cotisationStatus(mine.data);
  const { title, message } = describeStatus(status ?? 'aucune', mine.data);

  function open() {
    if (!status) return;
    const canPay = needsRenewal(status) && !!cotisations.url;
    Alert.alert(title, message, [
      ...(canPay ? [{ text: 'Régler en ligne', onPress: () => openPaymentPage(cotisations.url) }] : []),
      { text: 'Fermer', style: 'cancel' as const },
    ]);
  }

  return (
    <ListRow
      icon="card"
      title="Ma cotisation"
      subtitle={status ? STATUS_LABELS[status] : undefined}
      onPress={open}
    />
  );
}

/**
 * Reminder shown to a member whose dues are missing or about to end. Paying happens on the
 * association's own page, outside the app: nothing is locked, the bureau updates the status.
 */
export function CotisationBanner() {
  const { cotisations } = useTenantConfig();
  const mine = useMyCotisation();
  const { colors } = useTheme();
  if (!cotisations.enabled || mine.isPending || mine.isError) return null;

  const status = cotisationStatus(mine.data);
  if (!needsRenewal(status)) return null;
  const { title, message } = describeStatus(status, mine.data);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Icon name="card" size={24} color={status === 'expiree' ? colors.danger : colors.primary} />
        <View style={styles.text}>
          <Text variant="headline">{title}</Text>
          <Text variant="subhead" tone="secondary">
            {message}
            {cotisations.montant ? ` Montant : ${cotisations.montant}.` : ''}
          </Text>
        </View>
      </View>
      {cotisations.url ? (
        <>
          <Button title="Régler en ligne" icon="external" onPress={() => openPaymentPage(cotisations.url)} />
          <Text variant="footnote" tone="secondary">
            Le paiement se fait sur le site de l’association, en dehors de l’application. Le bureau met ensuite à jour
            votre statut.
          </Text>
        </>
      ) : (
        <Text variant="footnote" tone="secondary">
          Rapprochez-vous du bureau pour régler votre cotisation.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  text: { flex: 1, gap: 4 },
});
