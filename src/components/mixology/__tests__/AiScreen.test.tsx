import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import AiScreen from '@/app/ai';

let mockParams: { prompt?: string } = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    navigate: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    localState: {
      cellarIngredientIds: [],
    },
    userProfile: {
      nickname: 'lan Bai',
      avatarKey: 'avatarOne',
      avatarUri: null,
    },
  }),
}));

describe('AiScreen', () => {
  beforeEach(() => {
    mockParams = {};
  });

  it('shows the V0-styled mobile empty chat screen by default', async () => {
    const screen = await render(<AiScreen />);

    expect(screen.getByText('V0-Bartender')).toBeTruthy();
    expect(screen.getByText('今天想喝什么？')).toBeTruthy();
    expect(screen.getByPlaceholderText('询问饮品配方或寻求推荐…')).toBeTruthy();
    expect(screen.getByTestId('ai-menu-button')).toBeTruthy();
    expect(screen.getByTestId('ai-temp-chat-button')).toBeTruthy();
    expect(screen.getByTestId('ai-input-dock')).toBeTruthy();
  });

  it('opens an in-app styled history drawer that stays within the phone viewport', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.press(screen.getByTestId('ai-menu-button'));

    const drawer = screen.getByTestId('ai-history-drawer');
    const drawerStyle = StyleSheet.flatten(drawer.props.style);

    expect(drawer).toBeTruthy();
    expect(drawerStyle.width).toBeLessThanOrEqual(340);
    expect(screen.getByText('lan Bai')).toBeTruthy();
    expect(screen.getByPlaceholderText('搜索')).toBeTruthy();
    expect(screen.getByText('昨天')).toBeTruthy();
    expect(screen.getByText('过去 7 天')).toBeTruthy();
  });

  it('starts a temporary chat from the top action', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.press(screen.getByTestId('ai-temp-chat-button'));

    expect(screen.getByText('临时对话')).toBeTruthy();
    expect(screen.getByText('今天想喝什么？')).toBeTruthy();
  });

  it('starts a prompt route in chat with a matching user message', async () => {
    mockParams = { prompt: '给我一杯金汤力' };

    const screen = await render(<AiScreen />);

    expect(screen.getByText('V0-Bartender')).toBeTruthy();
    expect(screen.getByText('给我一杯金汤力')).toBeTruthy();
    expect(screen.queryByText('今天想喝什么？')).toBeNull();
    expect(screen.queryByText('我想来一杯玛格丽特')).toBeNull();
  });

  it('sends a message from the V0-styled input bar', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('询问饮品配方或寻求推荐…'), '推荐一杯低酒精鸡尾酒');
    await fireEvent.press(screen.getByTestId('ai-send-button'));

    expect(screen.getByText('推荐一杯低酒精鸡尾酒')).toBeTruthy();
    expect(screen.queryByText('今天想喝什么？')).toBeNull();
  });
});
