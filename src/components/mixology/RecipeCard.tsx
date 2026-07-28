import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Clock, Martini } from 'lucide-react-native';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import type { CocktailRecipe } from '@/types/mixology';

export function RecipeCard({ recipe, compact = false }: { recipe: CocktailRecipe; compact?: boolean }) {
  const router = useRouter();

  return (
    <Pressable
      testID="recipe-card"
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={({ pressed }) => [styles.card, compact ? styles.compactCard : null, pressed ? styles.pressed : null]}>
      <ImageBackground
        testID="recipe-card-image"
        source={getImageAsset(recipe.imageKey)}
        imageStyle={styles.imageRadius}
        resizeMode="cover"
        style={compact ? styles.compactImage : styles.image}>
        <LinearGradient colors={gradients.overlayTop} style={styles.overlay}>
          <View style={[styles.copy, compact ? styles.compactCopy : null]}>
            <Text style={[styles.title, compact ? styles.compactTitle : null]}>{recipe.name}</Text>
            <Text style={[styles.english, compact ? styles.compactEnglish : null]}>{recipe.englishName}</Text>
            {!compact ? <Text style={styles.description} numberOfLines={2}>{recipe.description}</Text> : null}
            <View style={[styles.metaRow, compact ? styles.compactMetaRow : null]}>
              <View style={styles.metaPill}>
                <Clock color={colors.cyan} size={compact ? 12 : 13} />
                <Text style={[styles.metaText, compact ? styles.compactMetaText : null]}>{recipe.prepMinutes}分钟</Text>
              </View>
              <View style={styles.metaPill}>
                <Martini color={colors.pink} size={compact ? 12 : 13} />
                <Text style={[styles.metaText, compact ? styles.compactMetaText : null]}>{recipe.difficulty}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactCard: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    height: 172,
  },
  compactImage: {
    height: 132,
  },
  imageRadius: {
    borderRadius: radii.md,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  copy: {
    padding: 14,
  },
  compactCopy: {
    padding: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  compactTitle: {
    fontSize: 15,
  },
  english: {
    color: colors.textSoft,
    fontSize: 14,
    marginTop: 2,
  },
  compactEnglish: {
    fontSize: 12,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  compactMetaRow: {
    gap: 6,
    marginTop: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  compactMetaText: {
    fontSize: 11,
  },
});
