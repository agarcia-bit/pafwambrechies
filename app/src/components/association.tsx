import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { usePushOffer } from '@/lib/data';
import { dismissPushOffer, enablePush } from '@/lib/notifications';
import { useMember } from '@/lib/session';

export function associationName(branding: { tenant_name?: string; name?: string } | null): string {
  return branding?.tenant_name?.trim() || branding?.name || '';
}

/** Logo, name and tagline of the member's association. */
export function AssociationBanner() {
  const { branding } = useMember();
  const name = associationName(branding);
  return (
    <View style={styles.banner}>
      <Avatar name={name} uri={branding?.tenant_logo_url} size={44} />
      <View style={styles.bannerText}>
        <Text variant="headline">{name}</Text>
        {!!branding?.tenant_tagline && (
          <Text variant="footnote" tone="secondary">
            {branding.tenant_tagline}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Invites the member to turn on notifications once (never shown again after a choice). */
export function PushOffer() {
  const offer = usePushOffer();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!offer.data) return null;

  function close() {
    dismissPushOffer();
    client.invalidateQueries({ queryKey: ['push-offer'] });
    client.invalidateQueries({ queryKey: ['push-status'] });
  }

  async function enable() {
    setBusy(true);
    try {
      await enablePush();
    } catch {
      showMessage('Activation impossible', 'Réessayez depuis Plus › Mon compte.');
    }
    setBusy(false);
    close();
  }

  return (
    <Card style={styles.offer}>
      <View style={styles.offerHead}>
        <Icon name="bell" size={24} />
        <View style={styles.bannerText}>
          <Text variant="headline">Ne manquez aucune actu</Text>
          <Text variant="subhead" tone="secondary">
            Recevez une notification à chaque nouvelle publication de votre association.
          </Text>
        </View>
      </View>
      <View style={styles.offerButtons}>
        <Button title="Plus tard" variant="plain" onPress={close} style={styles.flex} />
        <Button title="Activer" onPress={enable} loading={busy} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16 },
  bannerText: { flex: 1, gap: 2 },
  offer: { marginHorizontal: 16, gap: 12 },
  offerHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  offerButtons: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
