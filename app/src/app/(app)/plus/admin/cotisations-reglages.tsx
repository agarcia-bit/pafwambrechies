import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage } from '@/lib/admin';
import { showMessage } from '@/lib/confirm';
import { useSaveCotisationSettings, type CotisationSettings } from '@/lib/cotisations';
import { useTenantConfig } from '@/lib/tenant-config';

// The bureau (not only the admins) runs the renewals: the campaign, the payment link and the amount.
export default function CotisationsReglagesScreen() {
  const { cotisations } = useTenantConfig();
  const save = useSaveCotisationSettings();
  const [s, setS] = useState<CotisationSettings>({
    url: cotisations.url,
    montant: cotisations.montant,
    libelle: cotisations.libelle,
    ouverture: cotisations.ouverture,
    fin: cotisations.fin,
    message: cotisations.message,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof CotisationSettings) => (value: string) => setS((current) => ({ ...current, [key]: value }));

  function submit() {
    const url = s.url.trim();
    if (url && !/^https:\/\//i.test(url)) {
      setError('Le lien de paiement doit commencer par https://.');
      return;
    }
    if (!!s.ouverture !== !!s.fin) {
      setError('Indiquez les deux dates de la campagne, ou aucune.');
      return;
    }
    if (s.ouverture && s.fin < s.ouverture) {
      setError('La fin de la période doit être après le début de la campagne.');
      return;
    }
    setError(null);
    save.mutate(s, {
      onSuccess: () => {
        showMessage('Enregistré');
        router.back();
      },
      onError: (e) => setError(adminErrorMessage(e)),
    });
  }

  return (
    <FormScreen>
      <View style={styles.section}>
        <Text variant="headline">Campagne de renouvellement</Text>
        <TextField
          label="Cotisation concernée"
          value={s.libelle}
          onChangeText={set('libelle')}
          placeholder="Ex : 2027 ou saison 2026-2027"
        />
        <DateField label="Début de la campagne" value={s.ouverture} optional onChange={set('ouverture')} />
        <DateField label="Cotisation valable jusqu’au" value={s.fin} optional onChange={set('fin')} />
        <Text variant="footnote" tone="secondary">
          À partir de la date de début, chaque adhérent dont la cotisation ne couvre pas cette période voit un bandeau
          rouge sur l’accueil et reçoit une notification par semaine, jusqu’à ce que vous enregistriez son
          renouvellement. Sans dates, aucun rappel n’est envoyé.
        </Text>
        <TextField
          label="Message aux adhérents (facultatif)"
          value={s.message}
          onChangeText={set('message')}
          placeholder="Ex : code promo RENOUV27, -20 € jusqu’au 15 décembre"
          multiline
          maxLength={500}
        />
        <Text variant="footnote" tone="secondary">
          Affiché dans la fenêtre « Ma cotisation » des adhérents qui ont à renouveler, pendant la campagne.
        </Text>
      </View>

      <SectionPaiement valeurs={s} modifier={set} />

      {error && <Text tone="danger">{error}</Text>}
      <Button title="Enregistrer" onPress={submit} loading={save.isPending} />
    </FormScreen>
  );
}

/** Le lien de paiement et le montant affiché aux adhérents. */
function SectionPaiement({ valeurs, modifier }: {
  valeurs: CotisationSettings;
  modifier: (cle: keyof CotisationSettings) => (valeur: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text variant="headline">Paiement</Text>
      <TextField
        label="Lien de paiement"
        value={valeurs.url}
        onChangeText={modifier('url')}
        placeholder="https://www.helloasso.com/associations/…"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Montant (affiché aux adhérents)"
        value={valeurs.montant}
        onChangeText={modifier('montant')}
        placeholder="Ex : 25 € par an"
      />
      <Text variant="footnote" tone="secondary">
        Le paiement se fait sur ce site (HelloAsso par exemple), pas dans l’app. Une fois le règlement reçu, marquez
        l’adhérent comme renouvelé dans la liste.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginBottom: 12 },
});
