import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import PublishPostScreen from '@/app/publish-post';
import {
  ContentTestProvider,
  createContentTestSnapshot,
} from '@/test-utils/ContentTestProvider';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    publishPost: jest.fn(),
  }),
}));

describe('PublishPostScreen 图片管理', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('从内置图库添加图片缩略图，点删除角标移除', async () => {
    const screen = await render(
      <ContentTestProvider>
        <PublishPostScreen />
      </ContentTestProvider>
    );
    // 等待挂载副作用（草稿加载）结束，避免 act 重叠吞掉后续状态更新
    await act(async () => {});

    fireEvent.press(screen.getByTestId('add-image-button'));
    await waitFor(() => {
      expect(screen.getByTestId('gallery-image-mojito')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('gallery-image-mojito'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^image-thumb-/).length).toBe(1);
    });

    // 同一张图库图不重复添加
    fireEvent.press(screen.getByTestId('gallery-image-mojito'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^image-thumb-/).length).toBe(1);
    });

    fireEvent.press(screen.getByTestId(/^remove-image-/));
    await waitFor(() => {
      expect(screen.queryAllByTestId(/^image-thumb-/).length).toBe(0);
    });
  });

  it('地点选择器使用当前内容快照中的酒吧', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.bars = [
      { ...snapshot.bars[0], id: 'remote-publish-bar', name: '后台发布地点' },
    ];
    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <PublishPostScreen />
      </ContentTestProvider>
    );
    await act(async () => {});

    fireEvent.press(screen.getByTestId('venue-row'));

    await waitFor(() => {
      expect(screen.getByText('后台发布地点')).toBeTruthy();
    });
  });

  it('labels publishing as the active community backend workflow', async () => {
    const screen = await render(
      <ContentTestProvider>
        <PublishPostScreen />
      </ContentTestProvider>
    );
    await act(async () => {});

    expect(screen.queryByText('社区发布内测')).toBeNull();
    expect(screen.queryByText(/当前笔记只保存在本机/)).toBeNull();
    expect(screen.getAllByText('发布笔记').length).toBeGreaterThanOrEqual(1);
  });
});
