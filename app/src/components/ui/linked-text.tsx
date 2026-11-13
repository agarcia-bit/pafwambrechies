import { Text as RNText, StyleSheet } from 'react-native';

import { Text, type TextProps } from '@/components/ui/text';
import { externalUrl, openLink } from '@/lib/links';
import { decouperMiseEnForme } from '@/lib/mise-en-forme';
import { useTheme } from '@/theme';

// split() with a capture group keeps the matches, at the odd positions.
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/**
 * Text whose web addresses open when tapped (typed by admins and members, never clickable otherwise),
 * with *italique* and **gras** written by hand (lib/mise-en-forme.ts).
 */
export function LinkedText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  return (
    <Text {...props}>
      {decouperMiseEnForme(children).map((morceau, i) => (
        <RNText key={i} style={[morceau.italique && styles.italique, morceau.gras && styles.gras]}>
          <AvecLiens texte={morceau.texte} />
        </RNText>
      ))}
    </Text>
  );
}

function AvecLiens({ texte }: { texte: string }) {
  const { colors } = useTheme();
  const parts = texte.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        // "voir www.site.fr." must not swallow the final dot.
        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? '';
        const url = part.slice(0, part.length - trailing.length);
        return (
          <RNText key={i}>
            <RNText
              accessibilityRole="link"
              onPress={() => openLink(externalUrl(url))}
              style={{ color: colors.primary, textDecorationLine: 'underline' }}>
              {url}
            </RNText>
            {trailing}
          </RNText>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  italique: { fontStyle: 'italic' },
  gras: { fontWeight: '700' },
});
