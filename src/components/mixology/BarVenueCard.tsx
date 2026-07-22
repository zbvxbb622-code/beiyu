import { type Href, useRouter } from 'expo-router';
import { Heart, MapPin, Star } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, radii } from '@/styles/mixologyTheme';
import type { BarVenue } from '@/types/mixology';

export function BarVenueCard({
  venue,
  favorite,
  onToggleFavorite,
}: {
  venue: BarVenue;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();

  return (
    <Pressable
      testID="bar-venue-card"
      onPress={() => router.push({ pathname: '/bar/[id]', params: { id: venue.id } } as unknown as Href)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View testID="bar-venue-cover" style={styles.imageWrap}>
        <Image source={getImageAsset(venue.imageKey)} resizeMode="cover" style={styles.image} />
        <View style={styles.distanceBadge}>
          <MapPin color={colors.text} size={11} />
          <Text style={styles.distanceText}>{venue.distanceLabel}</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{venue.name}</Text>
          <Pressable onPress={onToggleFavorite} hitSlop={10}>
            <Heart color={favorite ? colors.pink : colors.text} fill={favorite ? colors.pink : 'transparent'} size={20} />
          </Pressable>
        </View>
        <View style={styles.ratingRow}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Star
              key={index}
              color={index < Math.round(venue.rating) ? colors.pink : '#6a6266'}
              fill={index < Math.round(venue.rating) ? colors.pink : '#6a6266'}
              size={15}
            />
          ))}
          <Text style={styles.rating}>{venue.rating.toFixed(1)}</Text>
        </View>
        <Text style={styles.meta}>{venue.reviewCount}条评价  人均 ¥{venue.averageSpend}</Text>
        <View style={styles.tagRow}>
          {venue.tags.slice(0, 2).map((tag) => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
        <Text style={styles.description} numberOfLines={2}>{venue.description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panel,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.86,
  },
  imageWrap: {
    width: 112,
    height: 102,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.bgDeep,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bgDeep,
  },
  distanceBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  distanceText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  rating: {
    color: colors.pink,
    marginLeft: 4,
    fontSize: 15,
  },
  meta: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 5,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  tag: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
});
