import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, StyleSheet } from 'react-native';

import CommunityPostDetailScreen from '@/app/post/[id]';
import { getImageAsset } from '@/data/imageAssets';
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
const mockToggleCommentLike = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

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
    toggleCommentLike: mockToggleCommentLike,
  }),
}));

describe('CommunityPostDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    post.images = undefined;
    post.comments = [];
    mockAddPostComment.mockResolvedValue(undefined);
    mockToggleCommentLike.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
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

  it('lets users reply to and like comments', async () => {
    post.comments = [
      {
        id: 'comment-1',
        authorName: '测试账号',
        authorAvatarKey: 'avatarOne',
        text: '这杯我喜欢',
        date: '2026-08-02',
        likes: 2,
        likedByMe: false,
      },
      {
        id: 'reply-1',
        parentId: 'comment-1',
        authorName: '杯语用户',
        authorAvatarKey: 'avatarTwo',
        text: '我也想试试',
        date: '2026-08-02',
        likes: 1,
        likedByMe: true,
      },
    ];
    const screen = await render(<CommunityPostDetailScreen />);

    expect(screen.getByText('回复 1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('community-comment-reply-comment-1'));
    await fireEvent.changeText(screen.getByPlaceholderText('回复 测试账号…'), '下次一起喝');
    await fireEvent.press(screen.getByTestId('community-comment-send-button'));

    await waitFor(() => {
      expect(mockAddPostComment).toHaveBeenCalledWith('test-post', '下次一起喝', 'comment-1');
    });

    await fireEvent.press(screen.getByTestId('community-comment-like-reply-1'));
    expect(mockToggleCommentLike).toHaveBeenCalledWith('test-post', 'reply-1');
  });

  it('shows a recoverable alert when sending a comment fails', async () => {
    mockAddPostComment.mockRejectedValueOnce(new Error('network failed'));
    const screen = await render(<CommunityPostDetailScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('说点什么…'), '这家看起来不错');
    await fireEvent.press(screen.getByTestId('community-comment-send-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('评论失败', 'network failed');
    });
    expect(screen.getByPlaceholderText('说点什么…').props.value).toBe('这家看起来不错');
  });

  it('falls back to the cover asset when a detail local photo cannot render', async () => {
    post.images = [{ id: 'local', kind: 'uri', uri: 'file:///tmp/missing-detail.jpg' }];
    const screen = await render(<CommunityPostDetailScreen />);
    const image = screen.getByTestId('community-detail-image');

    expect(image.props.source).toEqual({ uri: 'file:///tmp/missing-detail.jpg' });

    fireEvent(image, 'error');

    await waitFor(() => {
      expect(screen.getByTestId('community-detail-image').props.source).toBe(getImageAsset('barInterior'));
    });
  });
});
