import { bundledContent } from '@/services/content/bundledContent';
import { mergeCommunityPosts } from '@/services/contentService';
import type { ContentSnapshot } from '@/services/content/contentSchemas';
import type { CommunityPost, SearchResult } from '@/types/mixology';

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function matches(text: string, query: string) {
  return normalize(text).includes(query);
}

export function searchAll(
  query: string,
  localPosts: CommunityPost[] = [],
  content: ContentSnapshot = bundledContent
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const results: SearchResult[] = [];

  // 酒谱
  for (const recipe of content.recipes) {
    if (
      matches(recipe.name, q) ||
      matches(recipe.englishName, q) ||
      recipe.tags.some((tag) => matches(tag, q)) ||
      recipe.ingredients.some((ing) => matches(ing.name, q))
    ) {
      results.push({
        type: 'recipe',
        id: recipe.id,
        title: recipe.name,
        subtitle: recipe.englishName,
        imageKey: recipe.imageKey,
        imageUrl: recipe.imageUrl,
      });
    }
  }

  // 酒吧
  for (const venue of content.bars) {
    if (
      matches(venue.name, q) ||
      matches(venue.address, q) ||
      venue.tags.some((tag) => matches(tag, q)) ||
      venue.menu.some((item) => matches(item.name, q))
    ) {
      results.push({
        type: 'venue',
        id: venue.id,
        title: venue.name,
        subtitle: venue.address,
        imageKey: venue.imageKey,
        imageUrl: venue.imageUrl,
      });
    }
  }

  // 社区帖子
  for (const post of mergeCommunityPosts(localPosts)) {
    if (matches(post.title, q) || matches(post.body, q) || matches(post.authorName, q)) {
      results.push({
        type: 'post',
        id: post.id,
        title: post.title,
        subtitle: post.authorName,
        imageKey: post.imageKey,
      });
    }
  }

  return results;
}
