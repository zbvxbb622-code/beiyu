import { LinearGradient } from 'expo-linear-gradient';
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
  const borderColors = card.borderColors ?? [card.borderColor, card.borderColor];

  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.border}>
      <Pressable
        onPress={() => router.push({ pathname: '/cellar-card/[id]', params: { id: card.id } } as unknown as Href)}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
        <ImageBackground source={getImageAsset(card.imageKey)} resizeMode="cover" imageStyle={styles.imageRadius} style={styles.image}>
          <View style={styles.likeBubble}>
            <Pressable onPress={onToggleLike} hitSlop={10} style={styles.like}>
              <Heart color={liked ? colors.pink : colors.text} fill={liked ? colors.pink : 'transparent'} size={15} />
              <Text style={styles.likeText}>{card.likes + (liked ? 1 : 0)}</Text>
            </Pressable>
          </View>
        </ImageBackground>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: {
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
  image: {
    height: 210,
    justifyContent: 'flex-end',
  },
  imageRadius: {
    borderRadius: 13.5,
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
});
