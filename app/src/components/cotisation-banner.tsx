import { Alert, Linking } from 'react-native';

import { AlertStrip } from '@/components/alert-strip';
import { ListRow } from '@/components/ui/list';
import { showMessage } from '@/lib/confirm';
import {
  STATUS_LABELS,
  campaignOf,
  campaignOpen,
  cotisationStatus,
  describeStatus,
  needsRenewal,
  useMyCotisation,
  type Campaign,
  type CotisationStatus,
} from '@/lib/cotisations';
import { useTenantConfig } from '@/lib/tenant-config';

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
  config: { url: string; montant: string },
  campaign: Campaign | null
) {
  const { title, message } = describeStatus(status, validUntil, campaign);
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
  const campaign = campaignOf(cotisations);
  const status = mine.data === undefined ? null : cotisationStatus(mine.data, campaign);

  return (
    <ListRow
      icon="card"
      title="Ma cotisation"
      subtitle={status ? STATUS_LABELS[status] : undefined}
      onPress={status ? () => showDetails(status, mine.data, cotisations, campaign) : undefined}
    />
  );
}

/**
 * Thin red strip at the top of the home feed while a renewal campaign is open and the member's
 * dues do not cover it, like a pending poll: it stays until the bureau records the renewal.
 */
export function CotisationBanner() {
  const { cotisations } = useTenantConfig();
  const mine = useMyCotisation();
  if (!cotisations.enabled || mine.isPending || mine.isError) return null;

  const campaign = campaignOf(cotisations);
  const status = cotisationStatus(mine.data, campaign);
  if (!campaignOpen(campaign) || !needsRenewal(status)) return null;
  const { title } = describeStatus(status, mine.data, campaign);

  return (
    <AlertStrip
      icon="card"
      title={title}
      hint="Affiche le détail et le lien de paiement"
      onPress={() => showDetails(status, mine.data, cotisations, campaign)}
    />
  );
}
