import { useLocalSearchParams } from 'expo-router';
import { Heart, Navigation, Phone, Star, ThumbsUp } from 'lucide-react-native';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ContentImage } from '@/components/content/ContentImage';
import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getImageAsset } from '@/data/imageAssets';
import { useContent } from '@/state/ContentState';
import { useMixology } from '@/state/MixologyState';
import { colors, radii } from '@/styles/mixologyTheme';

export default function BarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { interactionState, toggleVenueFavorite } = useMixology();
  const { snapshot, isRefreshing, lastRefreshError, refresh } = useContent();
  const venue = snapshot.bars.find((item) => item.id === String(id));

  if (!venue) {
    return (
      <ScreenShell>
        <TopBar title="详情" />
        <Text style={styles.empty}>这家酒吧不存在</Text>
      </ScreenShell>
    );
  }

  const favorite = interactionState.favoriteVenueIds.includes(venue.id);

  return (
    <ScreenShell>
      <TopBar title="详情" right={<Pressable onPress={() => toggleVenueFavorite(venue.id)} hitSlop={10}><Heart color={favorite ? colors.pink : colors.text} fill={favorite ? colors.pink : 'transparent'} size={24} /></Pressable>} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.pink}
          />
        }>
        {lastRefreshError ? (
          <Text style={styles.refreshNotice}>{lastRefreshError}</Text>
        ) : null}
        <ContentImage
          testID="bar-detail-hero"
          imageKey={venue.imageKey}
          imageUrl={venue.imageUrl}
          resizeMode="cover"
          style={styles.hero}
        />
        <Text style={styles.name}>{venue.name}</Text>
        <View style={styles.ratingRow}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Star
              key={index}
              color={index < Math.round(venue.rating) ? colors.pink : '#5d5459'}
              fill={index < Math.round(venue.rating) ? colors.pink : '#5d5459'}
              size={19}
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
              <Navigation color={colors.text} size={22} />
              <Text style={styles.quickText}>导航</Text>
            </View>
            <View style={styles.quickAction}>
              <Phone color={colors.text} size={22} />
              <Text style={styles.quickText}>电话</Text>
            </View>
          </View>
        </View>

        <View style={styles.segment}>
          <View style={styles.segmentItem}>
            <Text style={styles.segmentActive}>菜品</Text>
            <View style={styles.segmentIndicator} />
          </View>
          <View style={styles.segmentItem}>
            <Text style={styles.segmentText}>评论</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>招牌 {venue.menu.length}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuRow}>
          {venue.menu.map((item) => (
            <View key={item.id} style={styles.menuCard}>
              <View style={styles.menuImageWrap}>
                <Image source={getImageAsset(item.imageKey)} resizeMode="cover" style={styles.menuImage} />
                {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
                <View style={styles.menuLikes}>
                  <ThumbsUp color={colors.text} size={12} />
                  <Text style={styles.menuLikeText}>{item.likes}人推荐</Text>
                </View>
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
              <ThumbsUp color={colors.text} size={17} />
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
  refreshNotice: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  empty: {
    color: colors.text,
    fontSize: 18,
    marginTop: 24,
  },
  hero: {
    width: '100%',
    height: 228,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    marginTop: 12,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  rating: {
    color: colors.pink,
    fontSize: 15,
    marginLeft: 6,
  },
  meta: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  score: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 10,
  },
  openHours: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  tag: {
    color: colors.textMuted,
    fontSize: 12,
    backgroundColor: colors.panelSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
  },
  addressCopy: {
    flex: 1,
  },
  address: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  metro: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 16,
  },
  quickAction: {
    alignItems: 'center',
    gap: 5,
  },
  quickText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  segment: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 56,
    marginTop: 26,
    marginBottom: 16,
  },
  segmentItem: {
    alignItems: 'center',
  },
  segmentActive: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  segmentIndicator: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.pink,
    marginTop: 5,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  menuRow: {
    gap: 12,
    paddingRight: 20,
  },
  menuCard: {
    width: 118,
  },
  menuImageWrap: {
    width: 118,
    height: 148,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  menuImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    color: colors.text,
    backgroundColor: colors.pink,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    fontSize: 11,
    fontWeight: '900',
  },
  menuLikes: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuLikeText: {
    color: colors.text,
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  menuName: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  review: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
    fontSize: 16,
    fontWeight: '800',
  },
  reviewText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 7,
  },
  reviewImages: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  reviewImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  reviewLike: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
