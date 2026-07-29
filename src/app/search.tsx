import { type Href, useRouter } from 'expo-router';
import { Clock, Search as SearchIcon, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { getContentImageSource, getImageAsset } from '@/data/imageAssets';
import { searchAll } from '@/services/searchService';
import { useContent } from '@/state/ContentState';
import { useMixology } from '@/state/MixologyState';
import { colors, radii } from '@/styles/mixologyTheme';
import type { SearchResult } from '@/types/mixology';

const typeLabels: Record<SearchResult['type'], string> = {
  recipe: '酒谱',
  venue: '酒吧',
  post: '帖子',
};

const typeRoutes: Record<SearchResult['type'], (id: string) => Href> = {
  recipe: (id) => ({ pathname: '/recipe/[id]', params: { id } } as unknown as Href),
  venue: (id) => ({ pathname: '/bar/[id]', params: { id } } as unknown as Href),
  post: (id) => ({ pathname: '/post/[id]', params: { id } } as unknown as Href),
};

export default function SearchScreen() {
  const router = useRouter();
  const { interactionState, addSearchHistory, clearSearchHistory } = useMixology();
  const { snapshot, isRefreshing, lastRefreshError, refresh } = useContent();
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => searchAll(query, interactionState.localCommunityPosts, snapshot),
    [query, interactionState.localCommunityPosts, snapshot]
  );

  const handleSubmit = () => {
    if (query.trim()) {
      addSearchHistory(query);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    addSearchHistory(query);
    router.push(typeRoutes[result.type](result.id));
  };

  return (
    <ScreenShell>
      <TopBar title="搜索" backHref="/" />
      <View style={styles.searchRow}>
        <SearchIcon color={colors.textMuted} size={20} />
        <TextInput
          autoFocus
          placeholder="搜酒谱、酒吧、帖子..."
          placeholderTextColor="#806f79"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.textMuted} size={18} />
          </Pressable>
        ) : null}
      </View>

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
        {!query ? (
          <View>
            {interactionState.searchHistory.length > 0 ? (
              <View>
                <View style={styles.historyHeader}>
                  <Text style={styles.sectionTitle}>搜索历史</Text>
                  <Pressable onPress={clearSearchHistory} hitSlop={8}>
                    <Text style={styles.clearText}>清空</Text>
                  </Pressable>
                </View>
                <View style={styles.historyWrap}>
                  {interactionState.searchHistory.map((item) => (
                    <Pressable key={item} onPress={() => setQuery(item)} style={styles.historyChip}>
                      <Clock color={colors.textMuted} size={14} />
                      <Text style={styles.historyText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.hint}>输入关键词，搜索酒谱、酒吧或社区帖子</Text>
            )}
          </View>
        ) : results.length === 0 ? (
          <Text style={styles.hint}>没有找到「{query}」相关的内容</Text>
        ) : (
          results.map((result) => (
            <Pressable key={`${result.type}-${result.id}`} onPress={() => handleResultPress(result)} style={styles.resultRow}>
              <Image
                source={getContentImageSource(result.imageKey, result.imageUrl)}
                defaultSource={getImageAsset(result.imageKey)}
                style={styles.resultImage}
              />
              <View style={styles.resultCopy}>
                <View style={styles.resultTitleRow}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{typeLabels[result.type]}</Text>
                  </View>
                </View>
                <Text style={styles.resultSubtitle} numberOfLines={1}>{result.subtitle}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.panel,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 120,
  },
  refreshNotice: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  clearText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  historyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyText: {
    color: colors.textSoft,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  typeBadge: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,47,159,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    color: colors.pink,
    fontSize: 11,
    fontWeight: '800',
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
});
