import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage } from '@/lib/admin';
import { showMessage } from '@/lib/confirm';
import { formatDay, fullName, plural } from '@/lib/format';
import { parseImport } from '@/lib/import-adherents';
import { useImportAdherents } from '@/lib/invitations';

const MAX_ROWS = 500;
const SHOWN = 3;

// The bureau pastes the list of its members, copied from Excel, Numbers or a CSV file.
export default function ImportScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const importRows = useImportAdherents();
  const parsed = useMemo(() => parseImport(text), [text]);
  const withDates = parsed.rows.filter((r) => r.valide_jusqu).length;
  const tooMany = parsed.rows.length > MAX_ROWS;

  function submit() {
    setError(null);
    importRows.mutate(parsed.rows, {
      onSuccess: (r) => {
        const lines = [
          r.invites ? `${plural(r.invites, 'adhérent ajouté', 'adhérents ajoutés')} à la liste à inviter.` : '',
          r.deja_inscrits ? `${plural(r.deja_inscrits, 'adhérent a', 'adhérents ont')} déjà un compte.` : '',
          r.cotisations ? `Cotisation mise à jour pour ${r.cotisations}.` : '',
          r.ignores ? `${plural(r.ignores, 'ligne ignorée', 'lignes ignorées')}.` : '',
        ].filter(Boolean);
        showMessage('Import terminé', lines.join('\n'));
        router.back();
      },
      onError: (e) => setError(adminErrorMessage(e)),
    });
  }

  return (
    <FormScreen>
      <Text tone="secondary">
        Copiez la liste de vos adhérents depuis Excel, Numbers ou un fichier CSV, puis collez-la ci-dessous : une ligne par
        adhérent, avec prénom, nom, e-mail et, si vous l’avez, la date de fin de cotisation (par exemple 31/12/2027).
        Les titres de colonnes sont reconnus s’il y en a.
      </Text>
      <TextField
        label="Liste des adhérents"
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'Prénom\tNom\tE-mail\tCotisation jusqu’au\nMarie\tDupont\tmarie@exemple.fr\t31/12/2027'}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      {!!text.trim() && (
        <Card style={styles.summary}>
          <Text variant="headline">
            {parsed.rows.length
              ? `${plural(parsed.rows.length, 'adhérent reconnu', 'adhérents reconnus')}`
              : 'Aucun adhérent reconnu'}
          </Text>
          {withDates > 0 && (
            <Text tone="secondary">dont {plural(withDates, 'avec une date de cotisation', 'avec une date de cotisation')}.</Text>
          )}
          {parsed.rows.slice(0, SHOWN).map((r) => (
            <Text key={r.email} variant="subhead" tone="secondary" numberOfLines={1}>
              {fullName(r.prenom, r.nom) || '—'} · {r.email}
              {r.valide_jusqu ? ` · jusqu’au ${formatDay(r.valide_jusqu)}` : ''}
            </Text>
          ))}
          {parsed.rows.length > SHOWN && (
            <Text variant="subhead" tone="secondary">
              et {parsed.rows.length - SHOWN} autres…
            </Text>
          )}
          {parsed.errors.length > 0 && (
            <View style={styles.errors}>
              <Text variant="subhead" tone="danger">
                {plural(parsed.errors.length, 'ligne ignorée', 'lignes ignorées')} :
              </Text>
              {parsed.errors.slice(0, SHOWN).map((e) => (
                <Text key={e.line} variant="footnote" tone="secondary" numberOfLines={1}>
                  Ligne {e.line} : {e.reason}
                </Text>
              ))}
              {parsed.errors.length > SHOWN && (
                <Text variant="footnote" tone="secondary">
                  et {parsed.errors.length - SHOWN} autres.
                </Text>
              )}
            </View>
          )}
        </Card>
      )}

      {tooMany && <Text tone="danger">Importez 500 adhérents au plus à la fois.</Text>}
      {error && <Text tone="danger">{error}</Text>}
      <Button
        title={parsed.rows.length ? `Importer ${plural(parsed.rows.length, 'adhérent')}` : 'Importer'}
        onPress={submit}
        disabled={!parsed.rows.length || tooMany}
        loading={importRows.isPending}
      />
      <Text variant="footnote" tone="secondary">
        Ceux qui ont déjà un compte ne sont pas invités : seule leur cotisation est mise à jour, si vous l’indiquez. Les
        autres apparaissent dans la liste à inviter, et seront reconnus quand ils créeront leur compte avec la même adresse
        e-mail.
      </Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 180 },
  summary: { gap: 6 },
  errors: { gap: 2, marginTop: 6 },
});
