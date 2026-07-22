import { useLocalSearchParams } from 'expo-router';
import { Heart, MessageCircle, MoreHorizontal, RotateCcw } from 'lucide-react-native';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
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
        <ImageBackground source={getImageAsset(card.imageKey)} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroActions}>
            <Pressable onPress={() => toggleCellarCardLike(card.id)} style={styles.heroAction}>
              <Heart color={colors.text} fill={liked ? colors.pink : 'transparent'} size={28} />
              <Text style={styles.actionText}>{card.likes + (liked ? 1 : 0)}</Text>
            </Pressable>
            <View style={styles.heroAction}>
              <MessageCircle color={colors.text} size={28} />
              <Text style={styles.actionText}>{card.comments}</Text>
            </View>
            <View style={styles.rotate}>
              <RotateCcw color={colors.text} size={24} />
            </View>
          </View>
        </ImageBackground>
        <View style={styles.copy}>
          <Text style={styles.title}>{card.name}</Text>
          <Text style={styles.script}>{card.englishName}</Text>
          <Text style={styles.section}>INGREDIENTS</Text>
          {card.ingredients.map((ingredient) => (
            <Text key={`${ingredient.id}-${ingredient.amount}`} style={styles.ingredient}>
              {ingredient.name}  <Text style={styles.ingredientEn}>{ingredient.id}</Text>  <Text style={styles.amount}>{ingredient.amount}</Text>
            </Text>
          ))}
          <Text style={styles.section}>METHOD</Text>
          {card.steps.map((step, index) => (
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
    paddingBottom: 42,
  },
  empty: {
    color: colors.text,
    fontSize: 18,
    marginTop: 24,
  },
  hero: {
    width: '100%',
    aspectRatio: 0.68,
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  heroImage: {
    borderRadius: radii.md,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 18,
    padding: 22,
  },
  heroAction: {
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rotate: {
    marginLeft: 'auto',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  actionText: {
    color: colors.text,
    fontSize: 14,
  },
  copy: {
    paddingHorizontal: 32,
    paddingTop: 28,
  },
  title: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
  },
  script: {
    color: colors.pink,
    textAlign: 'center',
    fontSize: 24,
    fontStyle: 'italic',
    marginTop: -2,
    marginBottom: 30,
    textShadowColor: colors.shadowPink,
    textShadowRadius: 10,
  },
  section: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    marginTop: 22,
    marginBottom: 18,
  },
  ingredient: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 34,
    fontWeight: '900',
  },
  ingredientEn: {
    fontSize: 18,
    color: colors.text,
  },
  amount: {
    color: colors.textMuted,
    fontSize: 16,
  },
  step: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 36,
    fontWeight: '800',
  },
});
