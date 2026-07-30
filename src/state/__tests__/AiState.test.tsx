import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { ApiError } from '@/services/api/authenticatedClient';
import type {
  AiMessageResponse,
  AiRepository,
  AiUsageResponse,
  ConversationResponse,
  SendMessageResponse,
  TemporaryMessageResponse,
} from '@/services/ai/aiRepository';
import { AiProvider, useAi } from '@/state/AiState';

type AiValue = ReturnType<typeof useAi>;

let currentValue: AiValue | null = null;
let mockAuthSnapshot = {
  status: 'signedIn' as 'signedIn' | 'signedOut' | 'restoring',
  session: { userId: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc', generation: 1 },
  bootstrapData: {
    user: {
      id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
      phoneMasked: '138****0000',
      status: 'ACTIVE',
      ageConfirmed: true,
      memoryEnabled: true,
      membershipLevel: 'FREE',
    },
    ai: { dailyMessageLimit: 50, messagesUsedToday: 0, remaining: 50, resetsAt: '2026-07-29T16:00:00Z' },
  },
  authenticatedRequest: jest.fn(),
  logout: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

jest.mock('@/state/AuthState', () => ({
  useAuth: () => mockAuthSnapshot,
}));

function Probe() {
  const value = useAi();
  useEffect(() => {
    currentValue = value;
  }, [value]);
  return <Text>{`${value.status}:${value.mode}:${value.messages.length}:${value.usage?.remaining ?? 'none'}`}</Text>;
}

const conversation: ConversationResponse = {
  id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
  title: '金汤力推荐',
  lastMessageAt: '2026-07-29T14:45:00Z',
  createdAt: '2026-07-29T14:40:00Z',
};

function message(id: string, role: AiMessageResponse['role'], content: string): AiMessageResponse {
  return {
    id,
    role,
    content,
    recipeIds: [],
    safetyLabel: 'SAFE',
    createdAt: '2026-07-29T14:45:00Z',
  };
}

const usage: AiUsageResponse = {
  limit: 50,
  used: 1,
  remaining: 49,
  resetsAt: '2026-07-29T16:00:00Z',
};

function sendResponse(input: { content?: string; remaining?: number } = {}): SendMessageResponse {
  return {
    conversation,
    userMessage: message('5364864c-3a48-4ca8-90b7-04f049b3227b', 'USER', input.content ?? '给我一杯金汤力'),
    assistantMessage: message('a6c4c674-f87d-4047-953c-914f720f6d42', 'ASSISTANT', '来一杯清爽的金汤力。'),
    usage: { ...usage, remaining: input.remaining ?? usage.remaining },
    memoryChanges: [],
  };
}

function temporaryResponse(input: { remaining?: number } = {}): TemporaryMessageResponse {
  return {
    assistantMessage: message('c6c4c674-f87d-4047-953c-914f720f6d42', 'ASSISTANT', '这条回复只在本次会话显示。'),
    usage: { ...usage, remaining: input.remaining ?? usage.remaining },
    memoryChanges: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createRepository(overrides: Partial<AiRepository> = {}): AiRepository {
  return {
    listConversations: jest.fn<AiRepository['listConversations']>().mockResolvedValue({
      items: [conversation],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }),
    createConversation: jest.fn<AiRepository['createConversation']>().mockResolvedValue(conversation),
    getConversation: jest.fn<AiRepository['getConversation']>().mockResolvedValue(conversation),
    deleteConversation: jest.fn<AiRepository['deleteConversation']>().mockResolvedValue(undefined),
    listMessages: jest.fn<AiRepository['listMessages']>().mockResolvedValue({
      items: [message('5364864c-3a48-4ca8-90b7-04f049b3227b', 'USER', '旧问题')],
      pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
    }),
    sendMessage: jest.fn<AiRepository['sendMessage']>().mockResolvedValue(sendResponse()),
    sendTemporaryMessage: jest.fn<AiRepository['sendTemporaryMessage']>().mockResolvedValue(temporaryResponse()),
    listMemories: jest.fn<AiRepository['listMemories']>().mockResolvedValue({ items: [] }),
    deleteMemory: jest.fn<AiRepository['deleteMemory']>().mockResolvedValue(undefined),
    clearMemories: jest.fn<AiRepository['clearMemories']>().mockResolvedValue(undefined),
    setMemoryEnabled: jest.fn<AiRepository['setMemoryEnabled']>().mockResolvedValue({ enabled: true }),
    getUsageToday: jest.fn<AiRepository['getUsageToday']>().mockResolvedValue(usage),
    ...overrides,
  } as AiRepository;
}

describe('AiProvider', () => {
  beforeEach(async () => {
    currentValue = null;
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockAuthSnapshot = {
      ...mockAuthSnapshot,
      status: 'signedIn',
      session: { userId: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc', generation: 1 },
      bootstrapData: {
        ...mockAuthSnapshot.bootstrapData,
        user: { ...mockAuthSnapshot.bootstrapData.user, id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc', memoryEnabled: true },
        ai: { dailyMessageLimit: 50, messagesUsedToday: 0, remaining: 50, resetsAt: '2026-07-29T16:00:00Z' },
      },
      logout: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
  });

  it('creates the first normal conversation only when the user sends', async () => {
    const repository = createRepository();
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      await currentValue!.send('给我一杯金汤力');
    });

    expect(repository.createConversation).toHaveBeenCalledTimes(1);
    expect(repository.sendMessage).toHaveBeenCalledWith(conversation.id, expect.objectContaining({
      content: '给我一杯金汤力',
      clientMessageId: expect.any(String),
    }));
    expect(currentValue?.selectedConversation?.title).toBe('金汤力推荐');
    expect(currentValue?.messages.map((item) => item.content)).toEqual(['给我一杯金汤力', '来一杯清爽的金汤力。']);
    expect(currentValue?.draft).toBe('');
  });

  it('blocks duplicate sends while one send is in flight', async () => {
    const gate = deferred<SendMessageResponse>();
    const repository = createRepository({
      sendMessage: jest.fn<AiRepository['sendMessage']>().mockReturnValue(gate.promise),
    });
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    let first!: Promise<void>;
    await act(async () => {
      first = currentValue!.send('第一条');
      await currentValue!.send('第二条');
      await Promise.resolve();
    });

    expect(repository.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve(sendResponse({ content: '第一条' }));
      await first;
    });
    expect(currentValue?.status).toBe('idle');
  });

  it('retains draft, created conversation, and client ID for exact retry after a provider error', async () => {
    const repository = createRepository({
      sendMessage: jest
        .fn<AiRepository['sendMessage']>()
        .mockRejectedValueOnce(new ApiError('AI_PROVIDER_TIMEOUT', 504, {}))
        .mockResolvedValueOnce(sendResponse({ content: '失败后重试' })),
    });
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      await currentValue!.send('失败后重试');
    });
    const failedClientId = currentValue!.pendingClientMessageId;

    expect(currentValue?.status).toBe('retryableError');
    expect(currentValue?.draft).toBe('失败后重试');
    expect(currentValue?.selectedConversation?.id).toBe(conversation.id);

    await act(async () => {
      await currentValue!.retry();
    });

    expect(repository.createConversation).toHaveBeenCalledTimes(1);
    expect(repository.sendMessage).toHaveBeenNthCalledWith(2, conversation.id, {
      content: '失败后重试',
      clientMessageId: failedClientId,
    });
    expect(currentValue?.status).toBe('idle');
    expect(currentValue?.draft).toBe('');
  });

  it('protects the selected conversation from stale history responses', async () => {
    const slow = deferred<{ items: AiMessageResponse[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } }>();
    const fastConversation = { ...conversation, id: '5364864c-3a48-4ca8-90b7-04f049b3227b', title: '快速对话' };
    const repository = createRepository({
      listMessages: jest
        .fn<AiRepository['listMessages']>()
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce({
          items: [message('6364864c-3a48-4ca8-90b7-04f049b3227b', 'USER', '快速消息')],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        }),
    });
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      void currentValue!.selectConversation(conversation);
      await currentValue!.selectConversation(fastConversation);
    });
    await waitFor(() => expect(currentValue?.messages[0]?.content).toBe('快速消息'));

    await act(async () => {
      slow.resolve({
        items: [message('7364864c-3a48-4ca8-90b7-04f049b3227b', 'USER', '陈旧消息')],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      });
      await Promise.resolve();
    });

    expect(currentValue?.selectedConversation?.id).toBe(fastConversation.id);
    expect(currentValue?.messages[0]?.content).toBe('快速消息');
  });

  it('keeps temporary messages only in runtime state and bounds outgoing context', async () => {
    const repository = createRepository();
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const secureSet = jest.spyOn(SecureStore, 'setItemAsync');
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      currentValue!.startTemporaryChat();
      await currentValue!.send('临时隐私 marker');
    });

    expect(repository.createConversation).not.toHaveBeenCalled();
    expect(repository.listConversations).not.toHaveBeenCalled();
    expect(repository.sendTemporaryMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: '临时隐私 marker',
      context: [],
    }));
    expect(currentValue?.messages.map((item) => item.content)).toEqual(['临时隐私 marker', '这条回复只在本次会话显示。']);
    expect(JSON.stringify(setItem.mock.calls)).not.toContain('临时隐私 marker');
    expect(JSON.stringify(secureSet.mock.calls)).not.toContain('临时隐私 marker');

    await act(async () => {
      await currentValue!.send('临时第二轮');
    });
    expect(repository.sendTemporaryMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      context: expect.arrayContaining([{ role: 'USER', content: '临时隐私 marker' }]),
    }));
  });

  it('clears runtime-only AI state on normal mode, unmount, logout, and session switch', async () => {
    const repository = createRepository();
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      currentValue!.startTemporaryChat();
      await currentValue!.send('临时内容');
      currentValue!.startNewChat();
    });
    expect(currentValue?.messages).toEqual([]);
    expect(currentValue?.mode).toBe('normal');

    await act(async () => {
      currentValue!.startTemporaryChat();
      await currentValue!.send('退出前内容');
      mockAuthSnapshot = { ...mockAuthSnapshot, status: 'signedOut' };
      screen.rerender(<AiProvider repository={repository}><Probe /></AiProvider>);
    });
    expect(currentValue?.messages).toEqual([]);
    expect(currentValue?.conversations).toEqual([]);

    await act(async () => {
      mockAuthSnapshot = {
        ...mockAuthSnapshot,
        status: 'signedIn',
        session: { userId: '5364864c-3a48-4ca8-90b7-04f049b3227b', generation: 2 },
      };
      screen.rerender(<AiProvider repository={repository}><Probe /></AiProvider>);
    });
    expect(currentValue?.messages).toEqual([]);
  });

  it('maps exhausted quota into a disabled state boundary', async () => {
    const repository = createRepository({
      sendMessage: jest
        .fn<AiRepository['sendMessage']>()
        .mockRejectedValueOnce(new ApiError('AI_DAILY_QUOTA_EXHAUSTED', 429, {})),
    });
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      await currentValue!.send('额度测试');
    });
    expect(currentValue?.status).toBe('quotaExhausted');
    expect(currentValue?.usage?.remaining).toBe(0);
  });

  it('logs out on unauthorized AI API errors while preserving retry state', async () => {
    const repository = createRepository({
      sendMessage: jest
        .fn<AiRepository['sendMessage']>()
        .mockRejectedValueOnce(new ApiError('AUTHENTICATION_REQUIRED', 401, {})),
    });
    const screen = await render(<AiProvider repository={repository}><Probe /></AiProvider>);
    await screen.findByText('idle:normal:0:50');

    await act(async () => {
      await currentValue!.send('登录过期');
    });
    expect(mockAuthSnapshot.logout).toHaveBeenCalledTimes(1);
    expect(currentValue?.status).toBe('retryableError');
  });
});
