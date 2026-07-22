import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { CommunityPostCard } from '@/components/mixology/CommunityPostCard';
import type { CommunityPost } from '@/types/mixology';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
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
});
