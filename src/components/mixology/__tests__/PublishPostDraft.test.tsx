import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import PublishPostScreen from '@/app/publish-post';
import { loadPostDraft } from '@/services/postDraftService';
import { colors } from '@/styles/mixologyTheme';

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
    back: jest.fn(),
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    publishPost: jest.fn(),
  }),
}));

describe('PublishPostScreen 存草稿', () => {
  beforeEach(async () => {
    mockRouterReplace.mockClear();
    await AsyncStorage.clear();
  });

  it('存草稿保存标题/正文/话题并返回社区', async () => {
    const screen = await render(<PublishPostScreen />);

    // 先选话题（changeText 之后再 press 在此测试环境下状态易丢失）
    await fireEvent.press(screen.getByTestId('topic-chip-调酒心得'));
    await waitFor(() => {
      const style = StyleSheet.flatten(screen.getByTestId('topic-chip-调酒心得').props.style);
      expect(style.borderColor).toBe(colors.pink);
    });

    await fireEvent.changeText(screen.getByTestId('title-input'), '草稿标题');
    await fireEvent.changeText(screen.getByTestId('body-input'), '草稿正文');
    await waitFor(() => {
      expect(screen.getByTestId('title-input').props.value).toBe('草稿标题');
      expect(screen.getByTestId('body-input').props.value).toBe('草稿正文');
    });

    await fireEvent.press(screen.getByTestId('draft-button'));

    // router.replace 在 savePostDraft 之后调用，replace 出现即代表草稿已写完
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/community');
    });
    const draft = await loadPostDraft();
    expect(draft?.title).toBe('草稿标题');
    expect(draft?.body).toBe('草稿正文');
    expect(draft?.topics).toEqual(['调酒心得']);
  });
});
