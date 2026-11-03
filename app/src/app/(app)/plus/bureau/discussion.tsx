import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type FlatListInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useBureau } from '@/lib/bureau';
import {
  markBureauRead,
  useBureauMessages,
  useBureauMute,
  useDeleteBureauMessage,
  useSendBureauMessage,
  type BureauMessage,
} from '@/lib/bureau-chat';
import { confirmAction, showMessage } from '@/lib/confirm';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

const GROUP_MS = 5 * 60_000;

function dayLabel(iso: string): string {
  const day = new Date(iso).toDateString();
  if (day === new Date().toDateString()) return 'Aujourd’hui';
  if (day === new Date(Date.now() - 86_400_000).toDateString()) return 'Hier';
  const label = new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * The bureau's discussion, like a group chat: the general thread (fil 0), or the thread
 * of a Pilotage action (fil = its id). Bureau and admins only; the same messages are on
 * the bureau's website.
 */
export default function DiscussionScreen() {
  const { fil: param } = useLocalSearchParams<{ fil?: string }>();
  const fil = Number(param) || 0;
  const { profile, isAdmin } = useMember();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const client = useQueryClient();
  const messages = useBureauMessages(fil);
  const send = useSendBureauMessage(fil);
  const remove = useDeleteBureauMessage(fil);
  const bureau = useBureau();
  const action = fil ? bureau.data?.actions.find((a) => a.id === fil) : undefined;
  const list = useRef<FlatListInstance>(null);
  const [text, setText] = useState('');
  const canSend = !!text.trim() && !send.isPending;

  // Opening the thread reads it.
  useEffect(() => {
    markBureauRead(fil).then(() => client.invalidateQueries({ queryKey: ['bureau-unread'] }));
  }, [fil, client]);

  function submit() {
    if (!canSend) return;
    send.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: () => showMessage('Message non envoyé', 'Vérifiez votre connexion et réessayez.'),
    });
  }

  async function removeMessage(m: BureauMessage) {
    const ok = await confirmAction({ title: 'Supprimer ce message ?', confirmLabel: 'Supprimer', destructive: true });
    if (ok) remove.mutate(m.id, { onError: () => showMessage('Suppression impossible', 'Réessayez plus tard.') });
  }

  const data = messages.data ?? [];
  const title = fil ? (action ? `${action.emoji || '📌'} ${action.titre}` : 'Discussion') : 'Discussion du bureau';

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <Stack.Screen options={{ title, headerRight: fil ? undefined : () => <MuteButton /> }} />
      {messages.isPending ? (
        <LoadingState />
      ) : messages.isError ? (
        <ErrorState onRetry={messages.refetch} />
      ) : !data.length ? (
        <EmptyState
          title="Aucun message"
          message={
            fil
              ? 'Posez une question ou partagez une info sur cette action : tout le bureau la verra.'
              : 'Écrivez le premier message : tout le bureau le verra, ici et sur le site du bureau.'
          }
        />
      ) : (
        <FlatList
          ref={list}
          data={data}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const prev = data[index - 1];
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
            const grouped =
              !newDay && prev.auteur === item.auteur && Date.parse(item.created_at) - Date.parse(prev.created_at) < GROUP_MS;
            return (
              <Bubble
                message={item}
                mine={item.auteur === profile.id}
                grouped={grouped}
                day={newDay ? dayLabel(item.created_at) : null}
                onLongPress={item.auteur === profile.id || isAdmin ? () => removeMessage(item) : undefined}
              />
            );
          }}
        />
      )}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom - 6, 8) }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={fil ? 'Écrire à propos de cette action…' : 'Écrire au bureau…'}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            multiline
            maxLength={4000}
            accessibilityLabel="Votre message"
            onFocus={() => setTimeout(() => list.current?.scrollToEnd({ animated: true }), 350)}
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Envoyer" disabled={!canSend} onPress={submit} hitSlop={8}>
            <View style={styles.sendSlot}>
              {send.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Icon name="send" size={30} color={canSend ? colors.primary : colors.separator} />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  mine,
  grouped,
  day,
  onLongPress,
}: {
  message: BureauMessage;
  mine: boolean;
  grouped: boolean;
  day: string | null;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const name = message.auteur_nom ?? 'Ancien membre';
  return (
    <View>
      {day && (
        <View style={styles.dayRow}>
          <Text variant="caption" tone="secondary" style={[styles.day, { backgroundColor: colors.fill }]}>
            {day}
          </Text>
        </View>
      )}
      <View style={[styles.row, mine && styles.rowMine, { marginTop: grouped ? 3 : 10 }]}>
        {!mine && <View style={styles.avatarSlot}>{!grouped && <Avatar name={name} size={30} round />}</View>}
        <View style={[styles.body, mine && styles.bodyMine]}>
          {!grouped && (
            <Text variant="caption" tone="secondary" style={styles.head}>
              {mine ? timeLabel(message.created_at) : `${name} · ${timeLabel(message.created_at)}`}
            </Text>
          )}
          <Pressable
            onLongPress={onLongPress}
            accessibilityHint={onLongPress ? 'Appui long pour supprimer' : undefined}
            style={[
              styles.bubble,
              mine
                ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                : { backgroundColor: colors.card, borderBottomLeftRadius: 6 },
            ]}>
            <LinkedText variant="callout" style={mine ? styles.mineText : undefined}>
              {message.texte}
            </LinkedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Bell in the header of the general thread: notifications for the bureau's messages, on or off. */
function MuteButton() {
  const { muted, toggle } = useBureauMute();
  if (muted === undefined) return null;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: !muted }}
      accessibilityLabel="Notifications des messages du bureau"
      hitSlop={10}
      onPress={() =>
        toggle.mutate(!muted, {
          onSuccess: (mute) =>
            showMessage(
              mute ? 'Notifications coupées' : 'Notifications activées',
              mute
                ? 'Vous ne serez plus prévenu des nouveaux messages du bureau. Les compteurs restent visibles.'
                : 'Vous serez prévenu à chaque nouveau message du bureau.'
            ),
          onError: () => showMessage('Réglage non enregistré', 'Réessayez plus tard.'),
        })
      }>
      <View style={{ opacity: muted ? 0.55 : 1 }}>
        <Icon name="bell" size={22} color="#FFFFFF" />
        {muted && <View style={styles.muteSlash} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 },
  dayRow: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  day: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, overflow: 'hidden', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  avatarSlot: { width: 30 },
  body: { maxWidth: '78%', gap: 3, alignItems: 'flex-start' },
  bodyMine: { alignItems: 'flex-end' },
  head: { marginHorizontal: 6 },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  mineText: { color: '#FFFFFF' },
  composer: { paddingHorizontal: 12, paddingTop: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: 22, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  sendSlot: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  muteSlash: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: 10,
    height: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
});
