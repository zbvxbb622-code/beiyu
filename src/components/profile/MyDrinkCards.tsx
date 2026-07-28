import { type Href, useRouter } from 'expo-router';
import { PackageOpen } from 'lucide-react-native';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { rarityConfig } from '@/data/blindBoxCards';
import { getImageAsset } from '@/data/imageAssets';
import { colors, radii } from '@/styles/mixologyTheme';
import type { DrawnCardRecord } from '@/types/mixology';

export function MyDrinkCards({ drawnCards }: { drawnCards: DrawnCardRecord[] }) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>我的酒卡</Text>
        <Text style={styles.count}>{drawnCards.length} 张</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={drawnCards}
        keyExtractor={(record) => `${record.card.id}-${record.drawnAt}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const rarity = rarityConfig[item.card.rarity];
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.card.recipeId } } as unknown as Href)}
              style={[styles.card, { borderColor: rarity.borderColor }, index < drawnCards.length - 1 ? styles.cardMargin : null]}
            >
              <Image source={getImageAsset(item.card.imageKey)} style={styles.cardImage} />
              <Text style={styles.cardName} numberOfLines={1}>
                {item.card.name}
              </Text>
              <Text style={[styles.cardRarity, { color: rarity.borderColor }]}>{rarity.label}</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={() => router.push('/blind-box' as Href)} style={styles.drawEntryPressable} testID="my-cards-draw-entry">
            <View style={styles.drawEntry}>
              <PackageOpen color={colors.pink} size={32} />
              <Text style={styles.drawEntryText}>去抽卡</Text>
            </View>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  count: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingRight: 8,
  },
  card: {
    width: 108,
    height: 138,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    paddingBottom: 8,
  },
  cardMargin: {
    marginRight: 12,
  },
  cardImage: {
    width: '100%',
    height: 96,
    backgroundColor: colors.bgDeep,
  },
  cardName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  cardRarity: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
    paddingHorizontal: 8,
  },
  drawEntryPressable: {
    marginLeft: 12,
  },
  drawEntry: {
    width: 108,
    height: 138,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,47,159,0.4)',
    backgroundColor: 'rgba(255,47,159,0.06)',
  },
  drawEntryText: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
});
