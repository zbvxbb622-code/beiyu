import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import AiScreen from '@/app/ai';
import type { AiStateValue } from '@/state/AiState';
import { colors } from '@/styles/mixologyTheme';

let mockParams: { prompt?: string } = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSend = jest.fn<AiStateValue['send']>().mockResolvedValue(undefined);
const mockStartNewChat = jest.fn<AiStateValue['startNewChat']>();
const mockStartTemporaryChat = jest.fn<AiStateValue['startTemporaryChat']>();
const mockSelectConversation = jest.fn<AiStateValue['selectConversation']>().mockResolvedValue(undefined);
const mockDeleteConversation = jest.fn<AiStateValue['deleteConversation']>().mockResolvedValue(undefined);
let mockAiState: AiStateValue;

const recipeId = 'd9f72d47-7f0e-40db-87ab-f84f54e2fbcf';
const oneDayMs = 24 * 60 * 60 * 1000;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    navigate: jest.fn(),
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    userProfile: {
      nickname: 'lan Bai',
      avatarKey: 'avatarOne',
      avatarUri: null,
    },
  }),
}));

jest.mock('@/state/ContentState', () => ({
  useContent: () => ({
    snapshot: {
      recipes: [
        {
          id: recipeId,
          name: 'Gin Tonic',
          englishName: 'Gin Tonic',
          description: '清爽高球',
          tags: ['清爽'],
          ingredients: [
            { id: 'gin', name: '金酒', category: 'base', amount: '45ml' },
            { id: 'tonic-water', name: '汤力水', category: 'mixer', amount: '120ml' },
          ],
          steps: ['加冰', '倒入金酒和汤力水'],
          imageKey: 'ginTonic',
          difficulty: '入门',
          prepMinutes: 3,
        },
      ],
    },
  }),
}));

jest.mock('@/state/AiState', () => ({
  useAi: () => mockAiState,
}));

function baseAiState(overrides: Partial<AiStateValue> = {}): AiStateValue {
  const yesterday = new Date(Date.now() - oneDayMs).toISOString();
  return {
    status: 'idle',
    mode: 'normal',
    conversations: [
      {
        id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
        title: '昨天的金汤力',
        lastMessageAt: yesterday,
        createdAt: yesterday,
      },
    ],
    selectedConversation: null,
    messages: [],
    memories: [],
    memoryEnabled: true,
    usage: { limit: 50, used: 40, remaining: 10, resetsAt: '2026-07-29T16:00:00Z' },
    draft: '',
    error: null,
    lastMemoryChanges: [],
    pendingClientMessageId: null,
    isReady: true,
    setDraft: jest.fn(),
    loadConversations: jest.fn<AiStateValue['loadConversations']>().mockResolvedValue(undefined),
    selectConversation: mockSelectConversation,
    startNewChat: mockStartNewChat,
    startTemporaryChat: mockStartTemporaryChat,
    send: mockSend,
    retry: jest.fn<AiStateValue['retry']>().mockResolvedValue(undefined),
    deleteConversation: mockDeleteConversation,
    loadMemories: jest.fn<AiStateValue['loadMemories']>().mockResolvedValue(undefined),
    deleteMemory: jest.fn<AiStateValue['deleteMemory']>().mockResolvedValue(undefined),
    clearMemories: jest.fn<AiStateValue['clearMemories']>().mockResolvedValue(undefined),
    setMemoryEnabled: jest.fn<AiStateValue['setMemoryEnabled']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AiScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockAiState = baseAiState();
  });

  it('shows the beiyu mobile empty chat screen by default', async () => {
    const screen = await render(<AiScreen />);

    expect(screen.getByText('beiyu')).toBeTruthy();
    expect(screen.queryByText('V0-Bartender')).toBeNull();
    expect(screen.getByText('今天想喝什么？')).toBeTruthy();
    expect(screen.getByPlaceholderText('询问饮品配方或寻求推荐…')).toBeTruthy();
    expect(screen.getByTestId('ai-menu-button')).toBeTruthy();
    expect(screen.getByTestId('ai-temp-chat-button')).toBeTruthy();
    expect(screen.getByTestId('ai-temp-chat-timer-icon')).toBeTruthy();
    expect(screen.queryByTestId('ai-temp-chat-plus-icon')).toBeNull();
    const tempSurface = StyleSheet.flatten(screen.getByTestId('ai-temp-chat-button-surface').props.style);
    expect(tempSurface.backgroundColor).toBeUndefined();
    expect(tempSurface.borderColor).toBeUndefined();
    expect(tempSurface.borderRadius).toBeUndefined();
    expect(tempSurface.borderWidth).toBeUndefined();
    expect(screen.getByTestId('ai-close-button')).toBeTruthy();
    expect(screen.getByTestId('ai-input-dock')).toBeTruthy();
    expect(screen.getByText('今日还剩 10 次')).toBeTruthy();
  });

  it('exits the AI chat from the header close button', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.press(screen.getByTestId('ai-close-button'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('opens real grouped history and keeps the drawer within the phone viewport', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.press(screen.getByTestId('ai-menu-button'));

    const drawer = screen.getByTestId('ai-history-drawer');
    const drawerStyle = StyleSheet.flatten(drawer.props.style);

    expect(drawer).toBeTruthy();
    expect(drawerStyle.width).toBeLessThanOrEqual(340);
    expect(screen.getByText('lan Bai')).toBeTruthy();
    expect(screen.getByText('昨天')).toBeTruthy();
    expect(screen.getByText('昨天的金汤力')).toBeTruthy();
  });

  it('starts a temporary chat from the top action', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.press(screen.getByTestId('ai-temp-chat-button'));

    expect(mockStartTemporaryChat).toHaveBeenCalledTimes(1);
  });

  it('toggles out of temporary chat from the same top action', async () => {
    mockAiState = baseAiState({ mode: 'temporary' });
    const screen = await render(<AiScreen />);

    expect(screen.getByTestId('ai-temp-chat-button').props.accessibilityLabel).toBe('退出临时聊天');
    expect(screen.getByTestId('ai-temp-chat-timer-icon').props.color).toBe(colors.pink);
    await fireEvent.press(screen.getByTestId('ai-temp-chat-button'));

    expect(mockStartNewChat).toHaveBeenCalledTimes(1);
    expect(mockStartTemporaryChat).not.toHaveBeenCalled();
  });

  it('sends normal input through the provider and disables duplicate sends', async () => {
    const screen = await render(<AiScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('询问饮品配方或寻求推荐…'), '推荐一杯低酒精鸡尾酒');
    await fireEvent.press(screen.getByTestId('ai-send-button'));

    expect(mockAiState.setDraft).toHaveBeenCalledWith('推荐一杯低酒精鸡尾酒');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('renders retryable failures and valid recipe cards from the content snapshot only', async () => {
    mockAiState = baseAiState({
      status: 'retryableError',
      error: '回复暂时没有生成，请稍后重试',
      messages: [
        { id: 'user-1', role: 'USER', content: '给我一杯金汤力', recipeIds: [], safetyLabel: 'SAFE', createdAt: '2026-07-29T14:45:00Z' },
        { id: 'assistant-1', role: 'ASSISTANT', content: '推荐这杯。', recipeIds: [recipeId, 'missing-id'], safetyLabel: 'SAFE', createdAt: '2026-07-29T14:46:00Z' },
      ],
    });
    const screen = await render(<AiScreen />);

    expect(screen.getByText('回复暂时没有生成，请稍后重试')).toBeTruthy();
    expect(screen.getAllByText('Gin Tonic').length).toBeGreaterThan(0);
    expect(screen.queryByText('missing-id')).toBeNull();
  });

  it('consumes a route prompt exactly once after AI readiness and never in temporary mode', async () => {
    mockParams = { prompt: '给我一杯金汤力' };
    mockAiState = baseAiState({ isReady: false });
    const screen = await render(<AiScreen />);
    await screen.rerender(<AiScreen />);
    expect(mockSend).not.toHaveBeenCalled();

    mockAiState = baseAiState({ isReady: true });
    await screen.rerender(<AiScreen />);
    await screen.rerender(<AiScreen />);

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    expect(mockSend).toHaveBeenCalledWith('给我一杯金汤力', expect.any(String));

    mockSend.mockClear();
    mockAiState = baseAiState({ mode: 'temporary', isReady: true });
    await render(<AiScreen />);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
