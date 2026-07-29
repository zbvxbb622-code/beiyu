import { type Href, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getContentImageSource, getImageAsset } from '@/data/imageAssets';
import { colors } from '@/styles/mixologyTheme';
import type { BarVenue } from '@/types/mixology';

export function BarVenueCard({
  venue,
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
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}>
      <View testID="bar-venue-card-content" style={styles.card}>
        <Image
          testID="bar-venue-cover"
          source={getContentImageSource(venue.imageKey, venue.imageUrl)}
          defaultSource={getImageAsset(venue.imageKey)}
          resizeMode="cover"
          style={styles.image}
        />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>{venue.name}</Text>
          <View style={styles.ratingRow}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Star
                key={index}
                color={index < Math.round(venue.rating) ? colors.pink : '#5d5459'}
                fill={index < Math.round(venue.rating) ? colors.pink : '#5d5459'}
                size={14}
              />
            ))}
            <Text style={styles.rating}>{venue.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.meta}>{venue.reviewCount}条评价  人均 ¥{venue.averageSpend}</Text>
          <Text style={styles.metro} numberOfLines={1}>{venue.metroHint}</Text>
          <Text style={styles.description} numberOfLines={2}>{venue.description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.cardDark,
    marginBottom: 14,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.86,
  },
  image: {
    width: 128,
    height: 118,
    borderRadius: 12,
    marginRight: 13,
    backgroundColor: colors.bgDeep,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
  },
  rating: {
    color: colors.pink,
    marginLeft: 5,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  metro: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 5,
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
});
