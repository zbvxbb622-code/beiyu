import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii } from '@/styles/mixologyTheme';

export function IngredientChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null,
      ]}>
      {selected ? <Check color={colors.text} size={14} /> : null}
      <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  selected: {
    borderColor: colors.pink,
    backgroundColor: 'rgba(255,47,159,0.22)',
  },
  pressed: {
    opacity: 0.78,
  },
  label: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedLabel: {
    color: colors.text,
  },
});
