import { useLocalSearchParams } from 'expo-router';
import { Heart, MessageCircle, MoreHorizontal, RotateCcw } from 'lucide-react-native';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { englishLabels } from '@/components/mixology/NeonRecipeCard';
import { getImageAsset } from '@/data/imageAssets';
import { getSharedCellarCardById } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, radii } from '@/styles/mixologyTheme';

export default function CellarCardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { interactionState, toggleCellarCardLike } = useMixology();
  const card = getSharedCellarCardById(String(id));

  if (!card) {
    return (
      <ScreenShell>
        <TopBar title="卡片详情" />
        <Text style={styles.empty}>这张卡片不存在</Text>
      </ScreenShell>
    );
  }

  const liked = interactionState.likedCellarCardIds.includes(card.id);

  return (
    <ScreenShell padded={false}>
      <View style={styles.topWrap}>
        <TopBar title="卡片详情" right={<MoreHorizontal color={colors.text} size={26} />} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <ImageBackground source={getImageAsset(card.imageKey)} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage} />
          <View style={styles.heroActions}>
            <View style={styles.heroActionItem}>
              <Pressable onPress={() => toggleCellarCardLike(card.id)} style={styles.heroCircle}>
                <Heart color={colors.text} fill={liked ? colors.pink : 'transparent'} size={22} />
              </Pressable>
              <Text style={styles.actionText}>{card.likes + (liked ? 1 : 0)}</Text>
            </View>
            <View style={styles.heroActionItem}>
              <View style={styles.heroCircle}>
                <MessageCircle color={colors.text} size={22} />
              </View>
              <Text style={styles.actionText}>{card.comments}</Text>
            </View>
            <View style={[styles.heroCircle, styles.rotateCircle]}>
              <RotateCcw color={colors.text} size={21} />
            </View>
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{card.name}</Text>
          <Text style={styles.script}>{card.englishName}</Text>
          <Text style={styles.section}>INGREDIENTS</Text>
          {card.ingredients.map((ingredient) => (
            <View key={`${ingredient.id}-${ingredient.amount}`} style={styles.ingredientRow}>
              <Text style={styles.ingredient}>{ingredient.name}</Text>
              <Text style={styles.ingredientEn}>{englishLabels[ingredient.id] ?? ingredient.id}</Text>
              <Text style={styles.amount}>{ingredient.amount}</Text>
            </View>
          ))}
          <Text style={styles.section}>METHOD</Text>
          {card.steps.map((step, index) => (
            <Text key={step} style={styles.step}>{index + 1}.{step}</Text>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  content: {
    paddingBottom: 42,
  },
  empty: {
    color: colors.text,
    fontSize: 18,
    marginTop: 24,
  },
  heroWrap: {
    marginTop: 14,
    marginHorizontal: 10,
    marginBottom: 30,
  },
  hero: {
    width: '100%',
    aspectRatio: 0.72,
  },
  heroImage: {
    borderRadius: radii.md,
  },
  heroActions: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: -24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  heroActionItem: {
    alignItems: 'center',
    gap: 5,
  },
  heroCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,10,14,0.88)',
  },
  rotateCircle: {
    marginLeft: 'auto',
  },
  actionText: {
    color: colors.text,
    fontSize: 13,
  },
  copy: {
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  title: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '900',
  },
  script: {
    color: colors.pink,
    textAlign: 'center',
    fontSize: 21,
    fontStyle: 'italic',
    marginTop: -2,
    marginBottom: 26,
    textShadowColor: colors.shadowPink,
    textShadowRadius: 10,
  },
  section: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    marginTop: 20,
    marginBottom: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  ingredient: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  ingredientEn: {
    color: colors.text,
    fontSize: 16,
  },
  amount: {
    color: colors.textMuted,
    fontSize: 14,
  },
  step: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 30,
    fontWeight: '600',
  },
});
