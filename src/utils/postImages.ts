import type { ImageSourcePropType } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import type { CommunityPost, PostImage } from '@/types/mixology';

// 取帖子完整图片列表；旧数据无 images 字段时用封面图兜底
export function getPostImages(post: Pick<CommunityPost, 'imageKey' | 'images'>): PostImage[] {
  if (post.images?.length) {
    return post.images;
  }
  return [{ id: 'cover', kind: 'asset', assetKey: post.imageKey }];
}

export function resolvePostImageSource(image: PostImage): ImageSourcePropType {
  if (image.kind === 'uri') {
    return { uri: image.uri };
  }
  if (image.kind === 'remote') {
    return { uri: image.url };
  }
  return getImageAsset(image.assetKey);
}

// 卡片/瀑布流封面：优先第一张图（含上传 uri），兜底封面字段
export function getPostCoverSource(post: Pick<CommunityPost, 'imageKey' | 'images'>): ImageSourcePropType {
  const first = post.images?.[0];
  if (first) {
    return resolvePostImageSource(first);
  }
  return getImageAsset(post.imageKey);
}

// 从图片列表推导封面 imageKey（第一张 asset 图；纯 uri 图或无图时用兜底图）
export function deriveCoverImageKey(images: PostImage[], fallback = 'barInterior'): string {
  const firstAsset = images.find((image) => image.kind === 'asset');
  return firstAsset?.kind === 'asset' ? firstAsset.assetKey : fallback;
}
