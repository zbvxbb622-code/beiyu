import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
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
  venueId: 'amor-fati',
};

const mockRouterPush = jest.fn();
const mockAddPostComment = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-post' }),
  useRouter: () => ({
    push: mockRouterPush,
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
    addPostComment: mockAddPostComment,
  }),
}));

describe('CommunityPostDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddPostComment.mockResolvedValue(undefined);
  });

  it('caps the cover image height so it does not dominate the detail page', async () => {
    const screen = await render(<CommunityPostDetailScreen />);
    const image = screen.getByTestId('community-detail-image');
    const style = StyleSheet.flatten(image.props.style);

    expect(style.height).toBeLessThanOrEqual(260);
    expect(style.aspectRatio).toBeUndefined();
  });

  it('removes the associated bar button from community notes', async () => {
    const screen = await render(<CommunityPostDetailScreen />);

    expect(screen.queryByText('查看关联酒吧')).toBeNull();
  });

  it('sends a comment from the visible send button', async () => {
    const screen = await render(<CommunityPostDetailScreen />);

    expect(screen.queryByText('评论仅本机保存，正式社区后端上线前不会同步。')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('说点什么…'), '这家看起来不错');
    await fireEvent.press(screen.getByTestId('community-comment-send-button'));

    await waitFor(() => {
      expect(mockAddPostComment).toHaveBeenCalledWith('test-post', '这家看起来不错');
    });
  });
});
