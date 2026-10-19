import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View, type TextInputProps } from 'react-native';

import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import type { Field } from '@/lib/admin';
import { formatDay, hourMinute, isoDay, parseDay, todayISO } from '@/lib/format';
import { useTheme } from '@/theme';

const TEXT_PROPS: Partial<Record<Field['type'], TextInputProps>> = {
  multiline: { multiline: true },
  url: { keyboardType: 'url', autoCapitalize: 'none', autoCorrect: false },
  email: { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, autoComplete: 'email' },
  phone: { keyboardType: 'phone-pad', autoComplete: 'tel' },
};

/** One form field of an admin collection (photos are handled by PhotoField). */
export function FieldView({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  const label = field.required ? `${field.label} *` : field.label;
  switch (field.type) {
    case 'choice':
      return <ChoiceField label={label} options={field.options ?? []} value={value} onChange={onChange} />;
    case 'date':
      return <DateField label={label} value={value} optional={!field.required} onChange={onChange} />;
    case 'time':
      return <TimeField label={label} value={value} onChange={onChange} />;
    default:
      return (
        <TextField
          label={label}
          value={value}
          onChangeText={onChange}
          placeholder={field.placeholder}
          {...TEXT_PROPS[field.type]}
        />
      );
  }
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="secondary" style={styles.label}>
      {children}
    </Text>
  );
}

export function ChoiceField({
  label,
  options,
  value,
  onChange,
  format = (option) => option,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  /** Label of an option when it is not the value itself (e.g. a member id). */
  format?: (option: string) => string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.fill }]}>
              <Text variant="subhead" style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}>
                {format(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Dates are "YYYY-MM-DD" and times "HH:MM" strings. The native pickers have no
// web version: the web preview gets plain text inputs.

function DateField({
  label,
  value,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  optional: boolean;
  onChange: (value: string) => void;
}) {
  const { colors, scheme } = useTheme();
  if (Platform.OS === 'web') return <TextField label={label} value={value} onChangeText={onChange} placeholder="AAAA-MM-JJ" />;

  if (!value) {
    return (
      <View style={styles.field}>
        <FieldLabel>{label}</FieldLabel>
        <Button title="Ajouter une date" icon="calendar" variant="secondary" onPress={() => onChange(todayISO())} />
      </View>
    );
  }

  const date = parseDay(value);
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={[styles.pickerRow, { backgroundColor: colors.fill }]}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={date}
            mode="date"
            display="compact"
            locale="fr-FR"
            accentColor={colors.primary}
            themeVariant={scheme}
            onValueChange={(_, picked) => onChange(isoDay(picked))}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${formatDay(value)}`}
            onPress={() =>
              DateTimePickerAndroid.open({ value: date, mode: 'date', onValueChange: (_, picked) => onChange(isoDay(picked)) })
            }>
            <Text>{formatDay(value)}</Text>
          </Pressable>
        )}
        {optional && <HeaderButton title="Retirer" onPress={() => onChange('')} />}
      </View>
    </View>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { colors, scheme } = useTheme();
  if (Platform.OS === 'web') return <TextField label={label} value={value} onChangeText={onChange} placeholder="HH:MM" />;

  const [h, m] = (value || '09:00').split(':').map(Number);
  const time = new Date();
  time.setHours(h || 0, m || 0, 0, 0);
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={[styles.pickerRow, { backgroundColor: colors.fill }]}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={time}
            mode="time"
            display="compact"
            locale="fr-FR"
            minuteInterval={5}
            accentColor={colors.primary}
            themeVariant={scheme}
            onValueChange={(_, picked) => onChange(hourMinute(picked))}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${value}`}
            onPress={() =>
              DateTimePickerAndroid.open({
                value: time,
                mode: 'time',
                is24Hour: true,
                onValueChange: (_, picked) => onChange(hourMinute(picked)),
              })
            }>
            <Text>{value}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Current photo (URL) or the one just picked, with pick / remove buttons. */
export function PhotoField({
  label,
  uri,
  loading,
  onPick,
  onRemove,
}: {
  label: string;
  uri: string | null;
  loading: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      {uri ? (
        <Image source={{ uri }} style={[styles.photo, { backgroundColor: colors.fill }]} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.photoEmpty, { backgroundColor: colors.fill }]}>
          <Icon name="photo" size={32} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.photoButtons}>
        <Button
          title={uri ? 'Changer la photo' : 'Choisir une photo'}
          icon="photo"
          variant="secondary"
          loading={loading}
          onPress={onPick}
          style={styles.flex}
        />
        {uri && <Button title="Retirer" variant="plain" onPress={onRemove} />}
      </View>
    </View>
  );
}

/** Hex color with a live swatch ("#2E3192"). */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  const valid = /^#[0-9a-f]{6}$/i.test(value.trim());
  return (
    <View style={styles.colorRow}>
      <View style={styles.flex}>
        <TextField
          label={label}
          value={value}
          onChangeText={onChange}
          placeholder="#2E3192"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
        />
      </View>
      <View
        accessibilityLabel={valid ? `Aperçu de la couleur ${value}` : 'Couleur invalide'}
        style={[
          styles.swatch,
          { backgroundColor: valid ? value.trim() : colors.fill, borderColor: colors.separator },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { marginLeft: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderRadius: 17, paddingHorizontal: 14, paddingVertical: 8 },
  pickerRow: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  swatch: { width: 48, height: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
