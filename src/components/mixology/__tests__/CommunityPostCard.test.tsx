import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { CommunityPostCard } from '@/components/mixology/CommunityPostCard';
import { getImageAsset } from '@/data/imageAssets';
import type { CommunityPost } from '@/types/mixology';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const post: CommunityPost = {
  id: 'test-post',
  category: 'recommended',
  title: '今晚这家隐藏酒吧值得去',
  authorId: 'author',
  authorName: '调酒记录员',
  authorAvatarKey: 'avatarOne',
  imageKey: 'barInterior',
  body: '吧台灯光很好，酒单也有记忆点。',
  date: '2026-07-19',
  likes: 88,
  comments: [],
};

describe('CommunityPostCard', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
  });

  it('renders as a Xiaohongshu-style independent feed card', async () => {
    const screen = await render(<CommunityPostCard post={post} liked={false} onToggleLike={jest.fn()} />);

    expect(screen.getByTestId('community-post-card')).toBeTruthy();
    expect(screen.getByText('今晚这家隐藏酒吧值得去')).toBeTruthy();
  });

  it('keeps feed images compact for a two-column mobile layout', async () => {
    const screen = await render(<CommunityPostCard post={post} liked={false} onToggleLike={jest.fn()} />);
    const image = screen.getByTestId('community-post-image');
    const style = StyleSheet.flatten(image.props.style);

    expect(style.aspectRatio).toBeGreaterThanOrEqual(1.35);
  });

  it('accepts fixed card and image dimensions from the feed layout', async () => {
    const screen = await render(
      <CommunityPostCard post={post} liked={false} onToggleLike={jest.fn()} cardWidth={160} imageHeight={108} />
    );
    const card = screen.getByTestId('community-post-card');
    const image = screen.getByTestId('community-post-image');
    const cardStyle = StyleSheet.flatten(card.props.style);
    const imageStyle = StyleSheet.flatten(image.props.style);

    expect(cardStyle.width).toBe(160);
    expect(imageStyle.height).toBe(108);
  });

  it('falls back to the cover asset when a picked local photo cannot render', async () => {
    const screen = await render(
      <CommunityPostCard
        post={{ ...post, images: [{ id: 'local', kind: 'uri', uri: 'file:///tmp/missing.jpg' }] }}
        liked={false}
        onToggleLike={jest.fn()}
      />
    );
    const image = screen.getByTestId('community-post-image');

    expect(image.props.source).toEqual({ uri: 'file:///tmp/missing.jpg' });

    fireEvent(image, 'error');

    await waitFor(() => {
      expect(screen.getByTestId('community-post-image').props.source).toBe(getImageAsset('barInterior'));
    });
  });

  it('keeps the like button independent from opening the post detail', async () => {
    const onToggleLike = jest.fn();
    const screen = await render(<CommunityPostCard post={post} liked={false} onToggleLike={onToggleLike} />);

    await fireEvent.press(screen.getByTestId('community-post-like-button'));

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
