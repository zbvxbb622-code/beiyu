import { LinearGradient } from 'expo-linear-gradient';
import { Martini, RefreshCcw } from 'lucide-react-native';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/styles/mixologyTheme';
import type { CocktailIngredient } from '@/types/mixology';

// 食材 id → 英文标签（设计稿卡片上的英文名）
export const englishLabels: Record<string, string> = {
  gin: 'Gin',
  tequila: 'Tequila',
  rum: 'Rum',
  vodka: 'Vodka',
  whiskey: 'Whiskey',
  'orange-liqueur': 'Orange Liqueur',
  campari: 'Campari',
  'sweet-vermouth': 'Sweet Vermouth',
  'dry-vermouth': 'Dry Vermouth',
  bitters: 'Bitters',
  lime: 'Lime',
  lemon: 'Lemon',
  'tonic-water': 'Tonic Water',
  'soda-water': 'Soda Water',
  'ginger-beer': 'Ginger Beer',
  'simple-syrup': 'Simple Syrup',
  cola: 'Cola',
  mint: 'Mint',
  salt: 'Salt',
  ice: 'Ice',
  cherry: 'Cherry',
  'orange-peel': 'Orange Peel',
  olive: 'Olive',
};

// 配料色条配色（按序循环，还原设计稿的橙/绿/红/银配色）
const chipPalettes: { colors: [string, string]; text: string }[] = [
  { colors: ['#ff9a3d', '#e2631e'], text: '#ffffff' },
  { colors: ['#3ddc84', '#159a54'], text: '#ffffff' },
  { colors: ['#d64b3c', '#9e1f1f'], text: '#ffffff' },
  { colors: ['#e8e8e8', '#a8a8a8'], text: '#2a2a2a' },
];

// 色条空间窄：长英文名只取首词（Orange Liqueur → Orange），详情页仍用全称
function shortChipLabel(label: string) {
  return label.length > 9 ? label.split(' ')[0] : label;
}

export function NeonRecipeCard({
  title,
  script,
  meta,
  ingredients,
  steps,
  showFlip = false,
  style,
}: {
  title: string;
  script: string;
  meta: string;
  ingredients: CocktailIngredient[];
  steps: string[];
  showFlip?: boolean;
  style?: ViewStyle;
}) {
  const chipIngredients = ingredients.slice(0, 4);
  const extraIngredients = ingredients.slice(4);

  return (
    <LinearGradient colors={['#ff2f9f', '#9b30ff', '#2fe7ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.border, style]}>
      <View style={styles.inner}>
        <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.script}>{script}</Text>
      </View>
      <Text style={styles.meta}>{meta}</Text>

      <LinearGradient colors={['rgba(155,48,255,0.9)', 'rgba(155,48,255,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.divider} />

      <View style={styles.sectionHeader}>
        <Martini color="#9b30ff" size={18} />
        <Text style={styles.sectionTitle}>INGREDIENTS</Text>
      </View>
      <Text style={styles.triangles}>▽▽▽</Text>

      <View style={styles.chipRow}>
        {chipIngredients.map((ingredient, index) => {
          const palette = chipPalettes[index % chipPalettes.length];
          return (
            <View key={`${ingredient.id}-${index}`} style={styles.chipColumn}>
              <LinearGradient colors={palette.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                <Text style={[styles.chipText, { color: palette.text }]} numberOfLines={1}>
                  {shortChipLabel(englishLabels[ingredient.id] ?? ingredient.id)}
                </Text>
              </LinearGradient>
              <Text style={styles.ingredientName} numberOfLines={1}>{ingredient.name}</Text>
              <Text style={styles.ingredientAmount} numberOfLines={1}>{ingredient.amount}</Text>
            </View>
          );
        })}
      </View>

      {extraIngredients.length > 0 ? (
        <View style={styles.extraBlock}>
          <Text style={styles.triangles}>▽▽▽</Text>
          {extraIngredients.map((ingredient) => (
            <Text key={ingredient.id} style={styles.extraText}>
              {ingredient.name} <Text style={styles.extraEnglish}>{englishLabels[ingredient.id] ?? ingredient.id}</Text>
            </Text>
          ))}
        </View>
      ) : null}

      <View style={[styles.sectionHeader, styles.methodHeader]}>
        <Martini color="#9b30ff" size={18} />
        <Text style={styles.sectionTitle}>METHOD</Text>
      </View>
      {steps.map((step, index) => (
        <View key={`${index}-${step}`} style={styles.stepRow}>
          <Text style={styles.stepArrow}>↘</Text>
          <Text style={styles.stepText}>
            {index + 1}.{step}
          </Text>
        </View>
      ))}

      {showFlip ? <RefreshCcw color={colors.text} size={22} style={styles.flip} /> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: {
    borderRadius: 22,
    padding: 2.5,
    shadowColor: '#9b30ff',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  inner: {
    borderRadius: 19.5,
    backgroundColor: '#0e0714',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  script: {
    color: colors.pink,
    fontSize: 20,
    fontStyle: 'italic',
    marginLeft: 8,
    marginBottom: 2,
    textShadowColor: colors.shadowPink,
    textShadowRadius: 8,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  divider: {
    height: 1.5,
    borderRadius: 1,
    marginTop: 14,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  triangles: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 4,
    marginTop: 6,
    marginBottom: 10,
    marginLeft: 26,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipColumn: {
    flex: 1,
    minWidth: 0,
  },
  chip: {
    minHeight: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  ingredientName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  ingredientAmount: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  extraBlock: {
    marginTop: 12,
  },
  extraText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 26,
    marginBottom: 4,
  },
  extraEnglish: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  methodHeader: {
    marginTop: 22,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  stepArrow: {
    color: colors.pink,
    fontSize: 13,
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  flip: {
    position: 'absolute',
    right: 18,
    bottom: 18,
  },
});
