import { type Href, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ContentImage } from '@/components/content/ContentImage';
import { colors, radii, spacing } from '@/styles/mixologyTheme';
import type { BarVenue, CommunityPost, LocalInteractionState } from '@/types/mixology';
import { getCompactFeedImageHeight, splitMasonryColumns } from '@/utils/communityFeedLayout';
import { getPostCoverSource } from '@/utils/postImages';
import { getFavoriteVenues, getLikedPosts, getMyPosts } from '@/utils/profileFeed';

type TabId = 'posts' | 'favorites' | 'liked';

const tabs: { id: TabId; label: string }[] = [
  { id: 'posts', label: '笔记' },
  { id: 'favorites', label: '收藏' },
  { id: 'liked', label: '赞过' },
];

export function ProfileTabs({
  interactionState,
  onDeletePost,
}: {
  interactionState: LocalInteractionState;
  onDeletePost?: (postId: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('posts');
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - spacing.pageX * 2 - 10) / 2);

  const myPosts = getMyPosts(interactionState);
  const favoriteVenues = getFavoriteVenues(interactionState);
  const likedPosts = getLikedPosts(interactionState);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tabItem} testID={`profile-tab-${tab.id}`}>
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{tab.label}</Text>
              {active ? <View style={styles.tabIndicator} /> : <View style={styles.tabIndicatorPlaceholder} />}
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'posts' ? (
        <PostMasonry
          posts={myPosts}
          cardWidth={cardWidth}
          emptyHint="还没有发过笔记"
          emptyCta="去社区分享第一杯"
          emptyRoute="/publish-post"
          source="profile"
          onDeletePost={onDeletePost}
        />
      ) : null}
      {activeTab === 'favorites' ? (
        <VenueMasonry venues={favoriteVenues} cardWidth={cardWidth} />
      ) : null}
      {activeTab === 'liked' ? (
        <PostMasonry posts={likedPosts} cardWidth={cardWidth} emptyHint="还没有点赞过笔记" emptyCta="去社区逛逛" emptyRoute="/community" />
      ) : null}
      {activeTab === 'favorites' && favoriteVenues.length === 0 ? (
        <EmptyTabHint text="还没有收藏的酒吧" cta="去看看附近酒吧" route="/bars" />
      ) : null}
    </View>
  );
}

function PostMasonry({
  posts,
  cardWidth,
  emptyHint,
  emptyCta,
  emptyRoute,
  source,
  onDeletePost,
}: {
  posts: CommunityPost[];
  cardWidth: number;
  emptyHint: string;
  emptyCta: string;
  emptyRoute: Href;
  source?: 'profile';
  onDeletePost?: (postId: string) => Promise<void>;
}) {
  const router = useRouter();

  if (posts.length === 0) {
    return <EmptyTabHint text={emptyHint} cta={emptyCta} route={emptyRoute} />;
  }

  const columns = splitMasonryColumns(posts);
  const confirmDelete = (post: CommunityPost) => {
    Alert.alert('删除笔记', '删除后这条笔记会从我的主页和社区中移除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void onDeletePost?.(post.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.masonry}>
      {[columns.left, columns.right].map((column, columnIndex) => (
        <View key={columnIndex} style={[styles.column, columnIndex === 0 ? styles.columnMargin : null]}>
          {column.map((post, index) => (
            <Pressable
              testID={`profile-post-card-${post.id}`}
              key={post.id}
              onPress={() => router.push({ pathname: '/post/[id]', params: source ? { id: post.id, from: source } : { id: post.id } } as unknown as Href)}
              style={[styles.postCard, index < column.length - 1 ? styles.postCardMargin : null]}
            >
              <Image
                source={getPostCoverSource(post)}
                style={[styles.postImage, { width: cardWidth, height: getCompactFeedImageHeight(cardWidth, index) }]}
              />
              {onDeletePost ? (
                <Pressable
                  testID={`profile-delete-post-${post.id}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    confirmDelete(post);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.deleteButton, pressed ? styles.pressed : null]}
                  accessibilityLabel="删除笔记">
                  <Trash2 color={colors.text} size={15} strokeWidth={2.4} />
                </Pressable>
              ) : null}
              <View style={styles.postBody}>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.postMeta}>❤ {post.likes} · {post.date}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function VenueMasonry({ venues, cardWidth }: { venues: BarVenue[]; cardWidth: number }) {
  const router = useRouter();

  if (venues.length === 0) {
    return null; // 空态由外层渲染
  }

  const columns = splitMasonryColumns(venues);

  return (
    <View style={styles.masonry}>
      {[columns.left, columns.right].map((column, columnIndex) => (
        <View key={columnIndex} style={[styles.column, columnIndex === 0 ? styles.columnMargin : null]}>
          {column.map((venue, index) => (
            <Pressable
              key={venue.id}
              onPress={() => router.push({ pathname: '/bar/[id]', params: { id: venue.id } } as unknown as Href)}
              style={[styles.postCard, index < column.length - 1 ? styles.postCardMargin : null]}
            >
              <ContentImage
                imageKey={venue.imageKey}
                imageUrl={venue.imageUrl}
                resizeMode="cover"
                style={[styles.postImage, { width: cardWidth, height: getCompactFeedImageHeight(cardWidth, index) }]}
              />
              <View style={styles.postBody}>
                <Text style={styles.postTitle} numberOfLines={1}>
                  {venue.name}
                </Text>
                <Text style={styles.postMeta}>★ {venue.rating.toFixed(1)} · {venue.distanceLabel}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function EmptyTabHint({ text, cta, route }: { text: string; cta: string; route: Href }) {
  const router = useRouter();

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      <Pressable onPress={() => router.push(route)} style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: colors.text,
  },
  tabIndicator: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.pink,
    marginTop: 6,
  },
  tabIndicatorPlaceholder: {
    height: 3,
    marginTop: 6,
  },
  masonry: {
    flexDirection: 'row',
    marginTop: 14,
  },
  column: {
    flex: 1,
  },
  columnMargin: {
    marginRight: 10,
  },
  postCard: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  postCardMargin: {
    marginBottom: 12,
  },
  postImage: {
    backgroundColor: colors.bgDeep,
  },
  deleteButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  pressed: {
    opacity: 0.72,
  },
  postBody: {
    padding: 10,
  },
  postTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  postMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 34,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  emptyButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  emptyButtonText: {
    color: colors.pink,
    fontSize: 13,
    fontWeight: '800',
  },
});
