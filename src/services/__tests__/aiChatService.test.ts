import { describe, expect, it } from '@jest/globals';

import type { AuthenticatedClient } from '@/services/api/authenticatedClient';

import { createAiRepository } from '../aiChatService';

describe('aiChatService', () => {
  it('creates the typed AI repository from an authenticated client', () => {
    const request = (async () => undefined) as AuthenticatedClient['request'];
    const repository = createAiRepository({ request });

    expect(repository).toEqual(expect.objectContaining({
      listConversations: expect.any(Function),
      sendTemporaryMessage: expect.any(Function),
      setMemoryEnabled: expect.any(Function),
    }));
  });
});
