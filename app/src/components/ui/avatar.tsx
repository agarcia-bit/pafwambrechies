import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { initial } from '@/lib/format';
import { useTheme } from '@/theme';

/** Photo or initial in a rounded square (logos, merchants) or circle (people). */
export function Avatar({
  name,
  uri,
  size = 48,
  round = false,
}: {
  name: string | null | undefined;
  uri?: string | null;
  size?: number;
  round?: boolean;
}) {
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: round ? size / 2 : size * 0.22 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[shape, { backgroundColor: colors.fill }]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.placeholder, shape, { backgroundColor: colors.primarySoft }]}>
      <Text style={{ color: colors.primary, fontSize: size * 0.42, lineHeight: size * 0.5, fontWeight: '700' }}>
        {initial(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
