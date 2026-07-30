import { describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';

import type { AuthenticatedClient, FetchLike } from '@/services/api/authenticatedClient';
import { AiRepository } from '@/services/ai/aiRepository';

function createRepository(request: AuthenticatedClient['request']) {
  return new AiRepository({
    authenticatedClient: { request },
  });
}

describe('AiRepository', () => {
  it('uses typed authenticated calls for conversations and messages', async () => {
    const request = jest.fn(async (path: string, _init: RequestInit, schema: z.ZodType) => {
      if (path === '/ai/conversations') {
        return schema.parse({
          id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
          title: '新的对话',
          lastMessageAt: null,
          createdAt: '2026-07-29T14:40:00Z',
        });
      }
      return schema.parse({
        conversation: {
          id: '0f38f737-b8e9-4f75-8bb3-0b5a53f93afc',
          title: '新的对话',
          lastMessageAt: '2026-07-29T14:45:00Z',
          createdAt: '2026-07-29T14:40:00Z',
        },
        userMessage: {
          id: '5364864c-3a48-4ca8-90b7-04f049b3227b',
          role: 'USER',
          content: '给我一杯金汤力',
          recipeIds: [],
          safetyLabel: 'SAFE',
          createdAt: '2026-07-29T14:45:00Z',
        },
        assistantMessage: {
          id: 'a6c4c674-f87d-4047-953c-914f720f6d42',
          role: 'ASSISTANT',
          content: '来一杯清爽的金汤力。',
          recipeIds: [],
          safetyLabel: 'SAFE',
          createdAt: '2026-07-29T14:45:02Z',
        },
        usage: { limit: 50, used: 1, remaining: 49, resetsAt: '2026-07-29T16:00:00Z' },
        memoryChanges: [],
      });
    }) as unknown as jest.MockedFunction<AuthenticatedClient['request']>;
    const repository = createRepository(request);

    const conversation = await repository.createConversation();
    await repository.sendMessage(conversation.id, {
      content: '给我一杯金汤力',
      clientMessageId: '3333a62f-3f31-4647-9ac2-9914c9d5348d',
    });

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/ai/conversations',
      { method: 'POST' },
      expect.anything()
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/ai/conversations/0f38f737-b8e9-4f75-8bb3-0b5a53f93afc/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '给我一杯金汤力',
          clientMessageId: '3333a62f-3f31-4647-9ac2-9914c9d5348d',
        }),
      }),
      expect.anything()
    );
  });

  it('lists history, messages, memory, usage, and deletes with encoded IDs', async () => {
    const request = jest.fn(async (path: string, init: RequestInit, schema: z.ZodType) => {
      if (path.startsWith('/ai/conversations?')) {
        return schema.parse({ items: [], pagination: { page: 2, pageSize: 10, totalItems: 0, totalPages: 0 } });
      }
      if (path.includes('/messages?')) {
        return schema.parse({ items: [], pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 } });
      }
      if (path === '/ai/memories' && init.method === 'GET') {
        return schema.parse({ items: [] });
      }
      if (path === '/ai/usage/today') {
        return schema.parse({ limit: 50, used: 40, remaining: 10, resetsAt: '2026-07-29T16:00:00Z' });
      }
      return schema.parse(undefined);
    }) as unknown as jest.MockedFunction<AuthenticatedClient['request']>;
    const repository = createRepository(request);

    await repository.listConversations({ page: 2, pageSize: 10 });
    await repository.listMessages('conversation/id', { page: 1, pageSize: 50 });
    await repository.deleteConversation('conversation/id');
    await repository.listMemories();
    await repository.deleteMemory('memory/id');
    await repository.clearMemories();
    await repository.getUsageToday();

    expect(request).toHaveBeenCalledWith('/ai/conversations?page=2&pageSize=10', { method: 'GET' }, expect.anything());
    expect(request).toHaveBeenCalledWith('/ai/conversations/conversation%2Fid/messages?page=1&pageSize=50', { method: 'GET' }, expect.anything());
    expect(request).toHaveBeenCalledWith('/ai/conversations/conversation%2Fid', { method: 'DELETE' }, expect.anything());
    expect(request).toHaveBeenCalledWith('/ai/memories/memory%2Fid', { method: 'DELETE' }, expect.anything());
    expect(request).toHaveBeenCalledWith('/ai/memories', { method: 'DELETE' }, expect.anything());
  });

  it('sends temporary messages through the authenticated client only', async () => {
    const rawFetch = jest.fn<FetchLike>();
    const request = jest.fn(async (_path: string, _init: RequestInit, schema: z.ZodType) =>
      schema.parse({
        assistantMessage: {
          id: 'a6c4c674-f87d-4047-953c-914f720f6d42',
          role: 'ASSISTANT',
          content: '临时回答',
          recipeIds: [],
          safetyLabel: 'SAFE',
          createdAt: '2026-07-29T14:45:02Z',
        },
        usage: { limit: 50, used: 1, remaining: 49, resetsAt: '2026-07-29T16:00:00Z' },
        memoryChanges: [],
      })
    ) as unknown as jest.MockedFunction<AuthenticatedClient['request']>;
    const repository = createRepository(request);

    await repository.sendTemporaryMessage({
      content: '临时问题',
      clientMessageId: '3333a62f-3f31-4647-9ac2-9914c9d5348d',
      context: [{ role: 'USER', content: '上一轮临时问题' }],
    });

    expect(rawFetch).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      '/ai/temporary-messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '临时问题',
          clientMessageId: '3333a62f-3f31-4647-9ac2-9914c9d5348d',
          context: [{ role: 'USER', content: '上一轮临时问题' }],
        }),
      }),
      expect.anything()
    );
  });

  it('patches memory enabled state with the backend settings contract', async () => {
    const request = jest.fn(async (_path: string, _init: RequestInit, schema: z.ZodType) =>
      schema.parse({ enabled: false })
    ) as unknown as jest.MockedFunction<AuthenticatedClient['request']>;
    const repository = createRepository(request);

    await expect(repository.setMemoryEnabled(false)).resolves.toEqual({ enabled: false });
    expect(request).toHaveBeenCalledWith(
      '/ai/memory-settings',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ enabled: false }) }),
      expect.anything()
    );
  });
});
