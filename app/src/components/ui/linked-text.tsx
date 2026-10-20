import { Text as RNText } from 'react-native';

import { Text, type TextProps } from '@/components/ui/text';
import { externalUrl, openLink } from '@/lib/links';
import { useTheme } from '@/theme';

// split() with a capture group keeps the matches, at the odd positions.
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/** Text whose web addresses open when tapped (typed by admins and members, never clickable otherwise). */
export function LinkedText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  const { colors } = useTheme();
  const parts = children.split(URL_PATTERN);
  return (
    <Text {...props}>
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
    </Text>
  );
}
