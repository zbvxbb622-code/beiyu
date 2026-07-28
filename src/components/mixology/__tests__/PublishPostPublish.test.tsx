import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import PublishPostScreen from '@/app/publish-post';
import { colors } from '@/styles/mixologyTheme';

const mockPublishPost = jest.fn();
const mockRouterReplace = jest.fn();
// 用预填参数注入标题/正文/图片，驱动发布流程（等价盲盒分享链路）
const mockParams: Record<string, string> = {
  from: 'blind-box',
  title: '今晚的古典鸡尾酒',
  body: '方冰加大块橙皮，香气很顶。',
  imageKey: 'oldFashioned',
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
    back: jest.fn(),
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    publishPost: mockPublishPost,
  }),
}));

describe('PublishPostScreen 发布流程', () => {
  beforeEach(async () => {
    mockPublishPost.mockClear();
    mockRouterReplace.mockClear();
    await AsyncStorage.clear();
  });

  it('发布携带图片/话题/可见性/评论开关，成功后回社区', async () => {
    const screen = await render(<PublishPostScreen />);

    // 预填内容就位
    await waitFor(() => {
      expect(screen.getByTestId('title-input').props.value).toBe('今晚的古典鸡尾酒');
      expect(screen.getAllByTestId(/^image-thumb-/).length).toBe(1);
    });

    fireEvent.press(screen.getByTestId('topic-chip-威士忌'));
    await waitFor(() => {
      const style = StyleSheet.flatten(screen.getByTestId('topic-chip-威士忌').props.style);
      expect(style.borderColor).toBe(colors.pink);
    });

    // 切到仅自己可见
    fireEvent.press(screen.getByTestId('visibility-row'));
    await waitFor(() => {
      expect(screen.getByText('仅自己可见')).toBeTruthy();
    });

    // 高级选项里关闭评论
    fireEvent.press(screen.getByTestId('advanced-row'));
    await waitFor(() => {
      expect(screen.getByTestId('allow-comments-switch')).toBeTruthy();
    });
    fireEvent(screen.getByTestId('allow-comments-switch'), 'valueChange', false);
    await waitFor(() => {
      expect(screen.getByTestId('allow-comments-switch').props.value).toBe(false);
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('publish-button'));
    });

    await waitFor(() => {
      expect(mockPublishPost).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '今晚的古典鸡尾酒',
          body: '方冰加大块橙皮，香气很顶。',
          topics: ['威士忌'],
          visibility: 'private',
          allowComments: false,
          images: [expect.objectContaining({ kind: 'asset', assetKey: 'oldFashioned' })],
        })
      );
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/community');
    });
  });
});
