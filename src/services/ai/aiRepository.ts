import type { AuthenticatedClient } from '@/services/api/authenticatedClient';
import {
  aiUsageResponseSchema,
  conversationListResponseSchema,
  conversationResponseSchema,
  emptyAiResponseSchema,
  memoryListResponseSchema,
  memorySettingsResponseSchema,
  messageListResponseSchema,
  sendMessageRequestSchema,
  sendMessageResponseSchema,
  temporaryMessageRequestSchema,
  temporaryMessageResponseSchema,
  type SendMessageRequest,
  type TemporaryMessageRequest,
} from '@/services/ai/aiSchemas';

type AiRepositoryOptions = {
  authenticatedClient: AuthenticatedClient;
};

export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function pageQuery(input: PaginationInput = {}) {
  const params = new URLSearchParams();
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export class AiRepository {
  constructor(private readonly options: AiRepositoryOptions) {}

  listConversations(input: PaginationInput = {}) {
    return this.options.authenticatedClient.request(
      `/ai/conversations${pageQuery(input)}`,
      { method: 'GET' },
      conversationListResponseSchema
    );
  }

  createConversation() {
    return this.options.authenticatedClient.request(
      '/ai/conversations',
      { method: 'POST' },
      conversationResponseSchema
    );
  }

  getConversation(conversationId: string) {
    return this.options.authenticatedClient.request(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'GET' },
      conversationResponseSchema
    );
  }

  deleteConversation(conversationId: string) {
    return this.options.authenticatedClient.request(
      `/ai/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' },
      emptyAiResponseSchema
    );
  }

  listMessages(conversationId: string, input: PaginationInput = {}) {
    return this.options.authenticatedClient.request(
      `/ai/conversations/${encodeURIComponent(conversationId)}/messages${pageQuery(input)}`,
      { method: 'GET' },
      messageListResponseSchema
    );
  }

  sendMessage(conversationId: string, input: SendMessageRequest) {
    const payload = sendMessageRequestSchema.parse(input);
    return this.options.authenticatedClient.request(
      `/ai/conversations/${encodeURIComponent(conversationId)}/messages`,
      jsonRequest('POST', payload),
      sendMessageResponseSchema
    );
  }

  sendTemporaryMessage(input: TemporaryMessageRequest) {
    const payload = temporaryMessageRequestSchema.parse(input);
    return this.options.authenticatedClient.request(
      '/ai/temporary-messages',
      jsonRequest('POST', payload),
      temporaryMessageResponseSchema
    );
  }

  listMemories() {
    return this.options.authenticatedClient.request(
      '/ai/memories',
      { method: 'GET' },
      memoryListResponseSchema
    );
  }

  deleteMemory(memoryId: string) {
    return this.options.authenticatedClient.request(
      `/ai/memories/${encodeURIComponent(memoryId)}`,
      { method: 'DELETE' },
      emptyAiResponseSchema
    );
  }

  clearMemories() {
    return this.options.authenticatedClient.request(
      '/ai/memories',
      { method: 'DELETE' },
      emptyAiResponseSchema
    );
  }

  setMemoryEnabled(enabled: boolean) {
    return this.options.authenticatedClient.request(
      '/ai/memory-settings',
      jsonRequest('PATCH', { enabled }),
      memorySettingsResponseSchema
    );
  }

  getUsageToday() {
    return this.options.authenticatedClient.request(
      '/ai/usage/today',
      { method: 'GET' },
      aiUsageResponseSchema
    );
  }
}
