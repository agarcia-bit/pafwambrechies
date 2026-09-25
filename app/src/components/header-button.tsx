import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

/** Text button for navigation bars ("Annuler"). */
export function HeaderButton({ title, onPress, bold }: { title: string; onPress: () => void; bold?: boolean }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress}>
      {({ pressed }) => (
        <Text tone="primary" style={[{ opacity: pressed ? 0.5 : 1 }, bold && { fontWeight: '600' }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
