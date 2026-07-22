import { useLocalSearchParams } from 'expo-router';
import { Heart, Map, Phone, Star, ThumbsUp } from 'lucide-react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getImageAsset } from '@/data/imageAssets';
import { getBarVenueById } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, radii } from '@/styles/mixologyTheme';

export default function BarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { interactionState, toggleVenueFavorite } = useMixology();
  const venue = getBarVenueById(String(id));

  if (!venue) {
    return (
      <ScreenShell>
        <TopBar title="详情" />
        <Text style={styles.empty}>这家酒吧不存在</Text>
      </ScreenShell>
    );
  }

  const favorite = interactionState.favoriteVenueIds.includes(venue.id);
  const galleryImageKeys = Array.from(
    new Set([
      venue.imageKey,
      ...venue.menu.map((item) => item.imageKey),
      ...venue.reviews.flatMap((review) => review.imageKeys ?? []),
    ])
  ).slice(0, 5);

  return (
    <ScreenShell>
      <TopBar title="详情" right={<Pressable onPress={() => toggleVenueFavorite(venue.id)}><Heart color={favorite ? colors.pink : colors.text} fill={favorite ? colors.pink : 'transparent'} size={24} /></Pressable>} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
          {galleryImageKeys.map((imageKey, index) => (
            <Image
              key={`${imageKey}-${index}`}
              testID="bar-detail-gallery-image"
              source={getImageAsset(imageKey)}
              resizeMode="cover"
              style={styles.galleryImage}
            />
          ))}
        </ScrollView>
        <Text style={styles.name}>{venue.name}</Text>
        <View style={styles.ratingRow}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Star
              key={index}
              color={index < Math.round(venue.rating) ? colors.pink : '#6a6266'}
              fill={index < Math.round(venue.rating) ? colors.pink : '#6a6266'}
              size={20}
            />
          ))}
          <Text style={styles.rating}>{venue.rating.toFixed(1)}</Text>
          <Text style={styles.meta}>{venue.reviewCount}条评价  人均 ¥{venue.averageSpend}</Text>
        </View>
        <Text style={styles.score}>口味：{venue.tasteScore}  环境：{venue.environmentScore}  服务：{venue.serviceScore}</Text>
        <Text style={styles.openHours}>{venue.openHours}</Text>
        <View style={styles.tags}>
          {venue.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
        <View style={styles.addressRow}>
          <View style={styles.addressCopy}>
            <Text style={styles.address}>{venue.address}</Text>
            <Text style={styles.metro}>{venue.metroHint}</Text>
          </View>
          <View style={styles.quickActions}>
            <View style={styles.quickAction}>
              <Map color={colors.text} size={22} />
              <Text style={styles.quickText}>导航</Text>
            </View>
            <View style={styles.quickAction}>
              <Phone color={colors.text} size={22} />
              <Text style={styles.quickText}>电话</Text>
            </View>
          </View>
        </View>

        <View style={styles.segment}>
          <Text style={styles.segmentActive}>菜品</Text>
          <Text style={styles.segmentText}>评论</Text>
        </View>

        <Text style={styles.sectionTitle}>招牌 {venue.menu.length}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuRow}>
          {venue.menu.map((item) => (
            <View key={item.id} style={styles.menuCard}>
              <Image source={getImageAsset(item.imageKey)} resizeMode="cover" style={styles.menuImage} />
              {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
              <View style={styles.menuLikes}>
                <ThumbsUp color={colors.text} size={13} />
                <Text style={styles.menuLikeText}>{item.likes}人推荐</Text>
              </View>
              <Text style={styles.menuName}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>

        {venue.reviews.map((review) => (
          <View key={review.id} style={styles.review}>
            <Image source={getImageAsset(review.authorAvatarKey)} style={styles.reviewAvatar} />
            <View style={styles.reviewCopy}>
              <Text style={styles.reviewAuthor}>{review.authorName}</Text>
              <Text style={styles.reviewText}>{review.text}</Text>
              {review.imageKeys?.length ? (
                <View style={styles.reviewImages}>
                  {review.imageKeys.map((imageKey) => (
                    <Image key={imageKey} source={getImageAsset(imageKey)} resizeMode="cover" style={styles.reviewImage} />
                  ))}
                </View>
              ) : null}
              <Text style={styles.metro}>{review.date}</Text>
            </View>
            <View style={styles.reviewLike}>
              <ThumbsUp color={colors.text} size={18} />
              <Text style={styles.menuLikeText}>{review.likes}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  empty: {
    color: colors.text,
    fontSize: 18,
    marginTop: 24,
  },
  gallery: {
    gap: 12,
    paddingRight: 20,
    marginTop: 18,
  },
  galleryImage: {
    width: 236,
    height: 156,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
  },
  name: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 24,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  rating: {
    color: colors.pink,
    fontSize: 16,
    marginLeft: 6,
  },
  meta: {
    color: colors.text,
    fontSize: 16,
    marginLeft: 12,
  },
  score: {
    color: colors.textSoft,
    fontSize: 15,
    marginTop: 12,
  },
  openHours: {
    color: colors.textSoft,
    fontSize: 15,
    marginTop: 14,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  tag: {
    color: colors.textMuted,
    backgroundColor: colors.panelSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
  },
  addressCopy: {
    flex: 1,
  },
  address: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  metro: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 14,
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
  },
  quickText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  segment: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 50,
    marginTop: 32,
    marginBottom: 18,
  },
  segmentActive: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  menuRow: {
    gap: 14,
    paddingRight: 20,
  },
  menuCard: {
    width: 140,
  },
  menuImage: {
    width: 140,
    height: 118,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
  },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    color: colors.text,
    backgroundColor: colors.pink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '900',
  },
  menuLikes: {
    position: 'absolute',
    left: 8,
    bottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuLikeText: {
    color: colors.text,
    fontSize: 12,
  },
  menuName: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  review: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewCopy: {
    flex: 1,
  },
  reviewAuthor: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  reviewText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  reviewImages: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  reviewImage: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
  },
  reviewLike: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
