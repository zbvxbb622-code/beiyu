import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NeonRecipeCard } from '@/components/mixology/NeonRecipeCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { getImageAsset } from '@/data/imageAssets';
import { getSharedCellarCards } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import type { CocktailIngredient } from '@/types/mixology';

type MyCellarCard = {
  id: string;
  name: string;
  englishName: string;
  imageKey: string;
  likes: number;
  ingredients: CocktailIngredient[];
  steps: string[];
  bartender: string;
  borderColors: readonly [string, string];
};

// 霓虹边框按序循环（与设计稿多色卡片一致）
const borderPalette: readonly (readonly [string, string])[] = [
  ['#ff2f9f', '#ff8a3d'],
  ['#9b30ff', '#ff2f9f'],
  ['#2fe7ff', '#9b30ff'],
  ['#ffd24a', '#ff2f9f'],
];

export default function PrivateCellarScreen() {
  const { interactionState } = useMixology();
  const [activeCard, setActiveCard] = useState<MyCellarCard | null>(null);

  // 优先展示盲盒抽到的卡；还没抽卡时用共享酒柜 Mock 数据垫底，保证页面与设计稿一致
  const cards: MyCellarCard[] =
    interactionState.drawnCards.length > 0
      ? interactionState.drawnCards.map((record, index) => ({
          id: record.card.id,
          name: record.card.name,
          englishName: record.card.englishName,
          imageKey: record.card.imageKey,
          likes: 0,
          ingredients: record.card.ingredients,
          steps: record.card.steps,
          bartender: record.card.bartender,
          borderColors: borderPalette[index % borderPalette.length],
        }))
      : getSharedCellarCards().map((card, index) => ({
          id: card.id,
          name: card.name,
          englishName: card.englishName,
          imageKey: card.imageKey,
          likes: card.likes,
          ingredients: card.ingredients,
          steps: card.steps,
          bartender: '高鹏',
          borderColors: card.borderColors ?? borderPalette[index % borderPalette.length],
        }));

  return (
    <ScreenShell>
      <TopBar title="我的酒柜" backHref="/profile" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {cards.map((card) => (
            <LinearGradient key={card.id} colors={card.borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBorder}>
              <Pressable onPress={() => setActiveCard(card)} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
                <ImageBackground source={getImageAsset(card.imageKey)} resizeMode="cover" imageStyle={styles.cardImageRadius} style={styles.cardImage}>
                  <View style={styles.publicBadge}>
                    <Text style={styles.publicBadgeText}>公开</Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <View style={styles.like}>
                      <Heart color={colors.text} size={13} />
                      <Text style={styles.likeText}>{card.likes}</Text>
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
            </LinearGradient>
          ))}
        </View>
      </ScrollView>

      <Modal visible={activeCard !== null} transparent animationType="fade" onRequestClose={() => setActiveCard(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveCard(null)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalBody}>
            {activeCard ? (
              <>
                <NeonRecipeCard
                  title={activeCard.name}
                  script={activeCard.englishName}
                  meta={`经典调酒 / 调酒师${activeCard.bartender}`}
                  ingredients={activeCard.ingredients}
                  steps={activeCard.steps}
                  showFlip
                />
                <Pressable style={({ pressed }) => [styles.uploadButton, pressed ? styles.pressed : null]}>
                  <Upload color={colors.text} size={16} />
                  <Text style={styles.uploadText}>上传封面</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
    paddingBottom: spacing.bottomNavPadding,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardBorder: {
    width: '48.5%',
    borderRadius: 16,
    padding: 2.5,
    marginBottom: 16,
  },
  card: {
    borderRadius: 13.5,
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  pressed: {
    opacity: 0.86,
  },
  cardImage: {
    height: 190,
    justifyContent: 'space-between',
  },
  cardImageRadius: {
    borderRadius: 13.5,
  },
  publicBadge: {
    alignSelf: 'flex-end',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    margin: 10,
  },
  publicBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  cardBottom: {
    padding: 10,
  },
  like: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.36)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  likeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,0,2,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBody: {
    width: '100%',
  },
  uploadButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: '#241820',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 18,
  },
  uploadText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
