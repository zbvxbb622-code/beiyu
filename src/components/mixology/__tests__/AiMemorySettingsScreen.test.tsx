import { Alert } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import AiMemorySettingsScreen from '@/app/settings-ai-memory';
import type { AiStateValue } from '@/state/AiState';

const mockBack = jest.fn();
let mockAiState: AiStateValue;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/state/AiState', () => ({
  useAi: () => mockAiState,
}));

function baseAiState(overrides: Partial<AiStateValue> = {}): AiStateValue {
  return {
    status: 'idle',
    mode: 'normal',
    conversations: [],
    selectedConversation: null,
    messages: [],
    memories: [
      {
        id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
        category: 'DRINK_PREFERENCE',
        summary: '偏好清爽、低甜的饮品。',
        createdAt: '2026-07-29T14:45:00Z',
      },
      {
        id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
        category: 'EMOTIONAL_PREFERENCE',
        summary: '喜欢直接一点的推荐语气。',
        createdAt: '2026-07-29T14:46:00Z',
      },
    ],
    memoryEnabled: true,
    usage: null,
    draft: '',
    error: null,
    lastMemoryChanges: [],
    pendingClientMessageId: null,
    isReady: true,
    setDraft: jest.fn(),
    loadConversations: jest.fn<AiStateValue['loadConversations']>().mockResolvedValue(undefined),
    selectConversation: jest.fn<AiStateValue['selectConversation']>().mockResolvedValue(undefined),
    startNewChat: jest.fn(),
    startTemporaryChat: jest.fn(),
    send: jest.fn<AiStateValue['send']>().mockResolvedValue(undefined),
    retry: jest.fn<AiStateValue['retry']>().mockResolvedValue(undefined),
    deleteConversation: jest.fn<AiStateValue['deleteConversation']>().mockResolvedValue(undefined),
    loadMemories: jest.fn<AiStateValue['loadMemories']>().mockResolvedValue(undefined),
    deleteMemory: jest.fn<AiStateValue['deleteMemory']>().mockResolvedValue(undefined),
    clearMemories: jest.fn<AiStateValue['clearMemories']>().mockResolvedValue(undefined),
    setMemoryEnabled: jest.fn<AiStateValue['setMemoryEnabled']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AiMemorySettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAiState = baseAiState();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows memory summaries with user-facing category labels', async () => {
    const screen = await render(<AiMemorySettingsScreen />);

    await waitFor(() => expect(mockAiState.loadMemories).toHaveBeenCalledTimes(1));
    expect(screen.getByText('AI 记忆')).toBeTruthy();
    expect(screen.getByText('饮品偏好')).toBeTruthy();
    expect(screen.getByText('互动偏好')).toBeTruthy();
    expect(screen.getByText('偏好清爽、低甜的饮品。')).toBeTruthy();
    expect(screen.queryByText('memory_key')).toBeNull();
  });

  it('toggles memory enabled state', async () => {
    const screen = await render(<AiMemorySettingsScreen />);

    await fireEvent.press(screen.getByTestId('ai-memory-enabled-toggle'));

    expect(mockAiState.setMemoryEnabled).toHaveBeenCalledWith(false);
  });

  it('confirms individual delete and clear all', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    const screen = await render(<AiMemorySettingsScreen />);

    await fireEvent.press(screen.getByTestId('ai-memory-delete-0f38f737-b8e9-4f75-8bb3-0b5a53f93afc'));
    await fireEvent.press(screen.getByTestId('ai-memory-clear-all'));

    expect(alert).toHaveBeenCalledTimes(2);
    expect(mockAiState.deleteMemory).toHaveBeenCalledWith('0f38f737-b8e9-4f75-8bb3-0b5a53f93afc');
    expect(mockAiState.clearMemories).toHaveBeenCalledTimes(1);
  });

  it('shows disabled and empty states while preserving API errors', async () => {
    mockAiState = baseAiState({
      memoryEnabled: false,
      memories: [],
      error: 'AI 服务暂不可用，请稍后重试',
    });
    const screen = await render(<AiMemorySettingsScreen />);

    expect(screen.getByText('记忆已关闭')).toBeTruthy();
    expect(screen.getByText('暂无可展示的 AI 记忆')).toBeTruthy();
    expect(screen.getByText('AI 服务暂不可用，请稍后重试')).toBeTruthy();
  });

  it('returns to settings from the header', async () => {
    const screen = await render(<AiMemorySettingsScreen />);

    await fireEvent.press(screen.getByTestId('ai-memory-back-button'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
