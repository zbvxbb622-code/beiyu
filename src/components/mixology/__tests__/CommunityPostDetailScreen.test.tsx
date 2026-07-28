import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import CommunityPostDetailScreen from '@/app/post/[id]';
import type { CommunityPost } from '@/types/mixology';

const post: CommunityPost = {
  id: 'test-post',
  category: 'recommended',
  title: '今晚这家隐藏酒吧值得去',
  authorId: 'author',
  authorName: '调酒记录员',
  authorAvatarKey: 'avatarOne',
  imageKey: 'barInterior',
  body: '吧台灯光很舒服，适合慢慢喝一杯。',
  date: '2026-07-19',
  likes: 88,
  comments: [],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-post' }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/services/contentService', () => {
  const actual = jest.requireActual('@/services/contentService') as Record<string, unknown>;
  return {
    ...actual,
    getCommunityPostById: () => post,
  };
});

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: {
      likedPostIds: [],
      followedAuthorIds: [],
      localCommunityPosts: [],
      localPostComments: {},
    },
    togglePostLike: jest.fn(),
    toggleAuthorFollow: jest.fn(),
    addPostComment: jest.fn(),
  }),
}));

describe('CommunityPostDetailScreen', () => {
  it('renders the full-width cover image with the design aspect ratio', async () => {
    const screen = await render(<CommunityPostDetailScreen />);
    const image = screen.getByTestId('community-detail-image');
    const style = StyleSheet.flatten(image.props.style);

    expect(style.aspectRatio).toBeCloseTo(0.85, 2);
  });
});
