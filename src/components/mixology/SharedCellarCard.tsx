import { type Href, useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, radii } from '@/styles/mixologyTheme';
import type { SharedCellarCard as SharedCellarCardType } from '@/types/mixology';

export function SharedCellarCard({
  card,
  liked,
  onToggleLike,
}: {
  card: SharedCellarCardType;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/cellar-card/[id]', params: { id: card.id } } as unknown as Href)}
      style={({ pressed }) => [
        styles.card,
        { borderColor: card.borderColor },
        pressed ? styles.pressed : null,
      ]}>
      <ImageBackground source={getImageAsset(card.imageKey)} resizeMode="cover" imageStyle={styles.imageRadius} style={styles.image}>
        <View style={styles.likeBubble}>
          <Pressable onPress={onToggleLike} hitSlop={10} style={styles.like}>
            <Heart color={liked ? colors.pink : colors.text} fill={liked ? colors.pink : 'transparent'} size={16} />
            <Text style={styles.likeText}>{card.likes + (liked ? 1 : 0)}</Text>
          </Pressable>
        </View>
      </ImageBackground>
      <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
      <Text style={styles.english} numberOfLines={1}>{card.englishName}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderWidth: 3,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: colors.panel,
  },
  pressed: {
    opacity: 0.86,
  },
  image: {
    height: 218,
    justifyContent: 'flex-end',
  },
  imageRadius: {
    borderTopLeftRadius: radii.md - 2,
    borderTopRightRadius: radii.md - 2,
  },
  likeBubble: {
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
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  english: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 2,
  },
});
