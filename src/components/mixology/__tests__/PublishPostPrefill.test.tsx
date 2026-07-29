import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import PublishPostScreen from '@/app/publish-post';
import { ContentTestProvider } from '@/test-utils/ContentTestProvider';
import { defaultPostDraft, savePostDraft } from '@/services/postDraftService';

const mockRouterReplace = jest.fn();
const mockParams: Record<string, string> = {
  from: 'blind-box',
  title: '卡牌标题',
  body: '卡牌正文',
  imageKey: 'negroni',
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
    publishPost: jest.fn(),
  }),
}));

describe('PublishPostScreen 盲盒预填', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('预填参数直接恢复为表单内容，不加载本地草稿', async () => {
    await savePostDraft({ ...defaultPostDraft, title: '旧草稿标题', body: '旧草稿正文', savedAt: '2026-07-21T00:00:00.000Z' });

    const screen = await render(
      <ContentTestProvider>
        <PublishPostScreen />
      </ContentTestProvider>
    );
    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByTestId('title-input').props.value).toBe('卡牌标题');
    });
    expect(screen.getByTestId('body-input').props.value).toBe('卡牌正文');
    // 预填图恢复为缩略图
    expect(screen.getAllByTestId(/^image-thumb-/).length).toBe(1);
    // 不出现草稿恢复横幅
    expect(screen.queryByTestId('discard-draft')).toBeNull();
  });
});
