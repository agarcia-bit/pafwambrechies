import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDay, isoDay } from '@/lib/format';
import { usePollQueue } from '@/lib/poll-queue';
import { POSTPONE_MS } from '@/lib/poll-reminders';
import { useTheme } from '@/theme';

/** Polls the member put off: a card at the top of the feed, until answered (or until they cover the app again). */
export function PendingPolls() {
  const { colors } = useTheme();
  const { waiting, postponedAt, requestPoll } = usePollQueue();
  if (!waiting.length) return null;

  return (
    <View style={styles.block}>
      {waiting.map((poll) => {
        const at = postponedAt(poll.id);
        return (
          <Animated.View key={poll.id} exiting={FadeOut.duration(250)} layout={LinearTransition}>
            <Card style={[styles.card, { borderColor: colors.primary }]}>
              <View style={styles.head}>
                <Icon name="poll" size={20} />
                <Text variant="subhead" tone="primary" style={styles.label}>
                  ❗ Sondage en attente
                </Text>
              </View>
              <Text variant="headline">{poll.question}</Text>
              {!!poll.date_limite && (
                <Text variant="footnote" tone="secondary">
                  À répondre avant le {formatDay(poll.date_limite)}.
                </Text>
              )}
              {at != null && (
                <Text variant="footnote" tone="secondary">
                  Il redeviendra obligatoire le {formatDay(isoDay(new Date(at + POSTPONE_MS)))}.
                </Text>
              )}
              <Button title="Répondre" onPress={() => requestPoll(poll.id)} />
            </Card>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  card: { marginHorizontal: 16, gap: 10, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontWeight: '700' },
});
