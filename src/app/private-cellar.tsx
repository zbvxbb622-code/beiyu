import { Boxes, CircleCheckBig } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IngredientChip } from '@/components/mixology/IngredientChip';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { ingredients } from '@/data/ingredients';
import { useMixology } from '@/state/MixologyState';
import { colors, radii } from '@/styles/mixologyTheme';
import type { IngredientCategory } from '@/types/mixology';

const categoryLabels: Record<IngredientCategory, string> = {
  base: '基酒',
  liqueur: '利口酒',
  citrus: '柑橘',
  mixer: '汽水/调和',
  sweetener: '甜味',
  garnish: '装饰',
  tool: '基础材料',
};

export default function PrivateCellarScreen() {
  const { localState, toggleCellarIngredient } = useMixology();
  const selectedCount = localState.cellarIngredientIds.length;

  return (
    <ScreenShell>
      <TopBar title="我的酒柜" backHref="/profile" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Boxes color={colors.pink} size={28} />
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{selectedCount} 个材料已选择</Text>
            <Text style={styles.summaryText}>只保存在本机，用于 AI Mock 推荐，不会上传。</Text>
          </View>
        </View>

        {Object.entries(categoryLabels).map(([category, label]) => {
          const categoryIngredients = ingredients.filter((ingredient) => ingredient.category === category);

          return (
            <View key={category} style={styles.category}>
              <View style={styles.categoryTitleRow}>
                <CircleCheckBig color={colors.cyan} size={17} />
                <Text style={styles.categoryTitle}>{label}</Text>
              </View>
              <View style={styles.chips}>
                {categoryIngredients.map((ingredient) => (
                  <IngredientChip
                    key={ingredient.id}
                    label={ingredient.name}
                    selected={localState.cellarIngredientIds.includes(ingredient.id)}
                    onPress={() => toggleCellarIngredient(ingredient.id)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 36,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.md,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginTop: 10,
    marginBottom: 28,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  category: {
    marginBottom: 24,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
