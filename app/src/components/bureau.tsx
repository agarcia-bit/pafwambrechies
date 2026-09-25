import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ChoiceField, FieldView } from '@/components/form-fields';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  ACTION_STATUTS,
  DONE,
  isOverdue,
  memberName,
  useToggleTache,
  type Action,
  type ActionInput,
  type ActionStatut,
  type BureauMember,
  type Tache,
} from '@/lib/bureau';
import { showMessage } from '@/lib/confirm';
import { formatDayShort } from '@/lib/format';
import { useTheme } from '@/theme';

const STATUT_HUES: Record<string, string | undefined> = {
  'En cours': '#007AFF',
  Terminé: '#34C759',
  Bloqué: '#FF3B30',
};
const PRIORITE_HUES: Record<string, string | undefined> = { Haute: '#FF3B30', Moyenne: '#FF9500' };

export function StatutBadge({ statut }: { statut: string }) {
  return <Badge label={statut} hue={STATUT_HUES[statut]} />;
}

export function PrioriteBadge({ priorite }: { priorite: string }) {
  return <Badge label={priorite} hue={PRIORITE_HUES[priorite]} />;
}

function MemberLabel({ name }: { name: string }) {
  return (
    <View style={styles.member}>
      <Avatar name={name} size={20} round />
      <Text variant="footnote" tone="secondary">
        {name}
      </Text>
    </View>
  );
}

export function openAction(id: number) {
  router.push({ pathname: '/plus/bureau/action/[id]', params: { id: String(id) } });
}

export function openTache(actionId: number, id?: number) {
  router.push({
    pathname: '/plus/bureau/tache',
    params: id ? { actionId: String(actionId), id: String(id) } : { actionId: String(actionId) },
  });
}

/** Tick box, label, due date and owner; late tasks in red. */
export function TaskRow({ tache, members }: { tache: Tache; members: BureauMember[] }) {
  const { colors } = useTheme();
  const toggle = useToggleTache();
  const done = tache.statut === DONE;
  const late = isOverdue(tache.echeance, tache.statut);
  const meta = [tache.echeance && formatDayShort(tache.echeance), memberName(members, tache.responsable)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.task}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={tache.libelle}
        hitSlop={8}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggle.mutate(
            { id: tache.id, done: !done },
            { onError: () => showMessage('Modification impossible', 'Vérifiez votre connexion.') }
          );
        }}>
        <Icon name={done ? 'checkCircle' : 'circle'} size={24} color={done ? colors.success : colors.textSecondary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Modifier la tâche"
        style={styles.taskText}
        onPress={() => openTache(tache.action_id, tache.id)}>
        <Text style={done && { textDecorationLine: 'line-through', color: colors.textSecondary }}>{tache.libelle}</Text>
        <Text variant="footnote" style={{ color: late ? colors.danger : colors.textSecondary }}>
          {late ? `En retard · ${meta}` : meta}
        </Text>
      </Pressable>
      {!done && tache.priorite === 'Haute' && <PrioriteBadge priorite={tache.priorite} />}
    </View>
  );
}

/** An action and its tasks (`openOnly`: hide finished tasks). */
export function ActionCard({
  action,
  taches,
  members,
  openOnly,
  canAddTask,
}: {
  action: Action;
  taches: Tache[];
  members: BureauMember[];
  openOnly?: boolean;
  canAddTask?: boolean;
}) {
  const { colors } = useTheme();
  const shown = openOnly ? taches.filter((t) => t.statut !== DONE) : taches;
  const doneCount = taches.filter((t) => t.statut === DONE).length;
  const late = isOverdue(action.date_action, action.statut);

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${action.titre}, ${action.statut}`}
        onPress={() => openAction(action.id)}
        style={styles.cardHead}>
        <View style={styles.row}>
          <Text variant="footnote" style={{ color: late ? colors.danger : colors.textSecondary, fontWeight: '600' }}>
            {formatDayShort(action.date_action)}
            {late ? ' · en retard' : ''}
          </Text>
          <StatutBadge statut={action.statut} />
        </View>
        <Text variant="headline">
          {action.emoji ? `${action.emoji} ` : ''}
          {action.titre}
        </Text>
        <View style={styles.row}>
          <MemberLabel name={memberName(members, action.referent)} />
          <Text variant="footnote" tone="secondary">
            {[action.budget != null && `${action.budget} €`, taches.length > 0 && `${doneCount}/${taches.length} tâches`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </Pressable>
      {shown.length > 0 && (
        <View style={[styles.tasks, { borderTopColor: colors.separator }]}>
          {shown.map((t) => (
            <TaskRow key={t.id} tache={t} members={members} />
          ))}
        </View>
      )}
      {canAddTask && (
        <Button title="Nouvelle tâche" icon="plus" variant="plain" onPress={() => openTache(action.id)} />
      )}
    </Card>
  );
}

/** "Non assigné" or one of the bureau members (a former member stays shown when selected). */
export function MemberField({
  label,
  members,
  value,
  onChange,
}: {
  label: string;
  members: BureauMember[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const options = ['', ...members.filter((m) => m.is_bureau || m.id === value).map((m) => m.id)];
  return (
    <ChoiceField
      label={label}
      options={options}
      value={value ?? ''}
      onChange={(id) => onChange(id || null)}
      format={(id) => memberName(members, id || null)}
    />
  );
}

/** Fields shared by the new-action and action screens. */
export function ActionFields({
  values,
  members,
  onChange,
}: {
  values: ActionInput;
  members: BureauMember[];
  onChange: (values: ActionInput) => void;
}) {
  const set = <K extends keyof ActionInput>(key: K, value: ActionInput[K]) => onChange({ ...values, [key]: value });
  return (
    <>
      <View style={styles.titleRow}>
        <View style={styles.emoji}>
          <TextField
            label="Emoji"
            value={values.emoji ?? ''}
            onChangeText={(v) => set('emoji', v.trim() || null)}
            placeholder="🎉"
            maxLength={8}
          />
        </View>
        <View style={styles.flex}>
          <TextField label="Titre *" value={values.titre} onChangeText={(v) => set('titre', v)} />
        </View>
      </View>
      <FieldView
        field={{ key: 'date_action', label: 'Date', type: 'date', required: true }}
        value={values.date_action}
        onChange={(v) => set('date_action', v)}
      />
      <MemberField label="Référent" members={members} value={values.referent} onChange={(id) => set('referent', id)} />
      <ChoiceField
        label="Statut"
        options={ACTION_STATUTS}
        value={values.statut}
        onChange={(v) => set('statut', v as ActionStatut)}
      />
      <TextField
        label="Budget (€)"
        value={values.budget == null ? '' : String(values.budget)}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '');
          set('budget', digits ? Number.parseInt(digits, 10) : null);
        }}
        keyboardType="number-pad"
        placeholder="Facultatif"
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 10 },
  cardHead: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tasks: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 12 },
  task: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', gap: 12 },
  emoji: { width: 84 },
  flex: { flex: 1 },
});
