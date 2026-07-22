import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Clock, Martini } from 'lucide-react-native';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getImageAsset } from '@/data/imageAssets';
import { getRecipeById } from '@/services/recipeService';
import { colors, gradients, radii } from '@/styles/mixologyTheme';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipeById(String(id));

  if (!recipe) {
    return (
      <ScreenShell>
        <TopBar title="配方详情" />
        <Text style={styles.empty}>这杯酒不存在</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell padded={false}>
      <View style={styles.topWrap}>
        <TopBar title="配方详情" />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ImageBackground source={getImageAsset(recipe.imageKey)} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
          <LinearGradient colors={gradients.overlayTop} style={styles.heroOverlay}>
            <Text style={styles.title}>{recipe.name}</Text>
            <Text style={styles.script}>{recipe.englishName}</Text>
          </LinearGradient>
        </ImageBackground>
        <View style={styles.copy}>
          <Text style={styles.description}>{recipe.description}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Clock color={colors.cyan} size={16} />
              <Text style={styles.metaText}>{recipe.prepMinutes}分钟</Text>
            </View>
            <View style={styles.metaPill}>
              <Martini color={colors.pink} size={16} />
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          </View>
          <Text style={styles.section}>INGREDIENTS</Text>
          {recipe.ingredients.map((ingredient) => (
            <View key={`${ingredient.id}-${ingredient.amount}`} style={styles.ingredientRow}>
              <Text style={styles.ingredientName}>{ingredient.name}</Text>
              <Text style={styles.amount}>{ingredient.amount}</Text>
            </View>
          ))}
          <Text style={styles.section}>METHOD</Text>
          {recipe.steps.map((step, index) => (
            <Text key={step} style={styles.step}>{index + 1}. {step}</Text>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  content: {
    paddingBottom: 40,
  },
  empty: {
    color: colors.text,
    fontSize: 18,
    marginTop: 24,
  },
  hero: {
    width: '100%',
    aspectRatio: 0.9,
    marginTop: 18,
  },
  heroImage: {
    borderRadius: radii.md,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 28,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '900',
  },
  script: {
    color: colors.pink,
    fontSize: 24,
    fontStyle: 'italic',
    textShadowColor: colors.shadowPink,
    textShadowRadius: 10,
  },
  copy: {
    paddingHorizontal: 30,
    paddingTop: 24,
  },
  description: {
    color: colors.textSoft,
    fontSize: 16,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.panelSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaText: {
    color: colors.text,
    fontWeight: '800',
  },
  section: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    fontStyle: 'italic',
    marginTop: 30,
    marginBottom: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 11,
  },
  ingredientName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  amount: {
    color: colors.textMuted,
    fontSize: 17,
  },
  step: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 31,
    fontWeight: '800',
    marginBottom: 8,
  },
});
