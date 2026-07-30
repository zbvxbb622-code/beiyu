import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Crypto from 'expo-crypto';

import { ApiError } from '@/services/api/authenticatedClient';
import { AiRepository } from '@/services/ai/aiRepository';
import type {
  AiMemoryResponse,
  AiMessageResponse,
  AiUsageResponse,
  ConversationResponse,
  MemoryChange,
  SendMessageResponse,
  TemporaryContextMessage,
  TemporaryMessageResponse,
} from '@/services/ai/aiSchemas';
import { useAuth } from '@/state/AuthState';
import type { BootstrapResponse } from '@/services/auth/authSchemas';

export type AiViewStatus =
  | 'idle'
  | 'loadingHistory'
  | 'loadingConversation'
  | 'sending'
  | 'retryableError'
  | 'quotaExhausted'
  | 'temporary';

export type AiChatMode = 'normal' | 'temporary';

export type AiStateValue = {
  status: AiViewStatus;
  mode: AiChatMode;
  conversations: ConversationResponse[];
  selectedConversation: ConversationResponse | null;
  messages: AiMessageResponse[];
  memories: AiMemoryResponse[];
  memoryEnabled: boolean;
  usage: AiUsageResponse | null;
  draft: string;
  error: string | null;
  lastMemoryChanges: MemoryChange[];
  pendingClientMessageId: string | null;
  isReady: boolean;
  setDraft: (value: string) => void;
  loadConversations: () => Promise<void>;
  selectConversation: (conversation: ConversationResponse) => Promise<void>;
  startNewChat: () => void;
  startTemporaryChat: () => void;
  send: (content?: string, clientMessageId?: string) => Promise<void>;
  retry: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  loadMemories: () => Promise<void>;
  deleteMemory: (memoryId: string) => Promise<void>;
  clearMemories: () => Promise<void>;
  setMemoryEnabled: (enabled: boolean) => Promise<void>;
};

type AiProviderProps = {
  children: ReactNode;
  repository?: AiRepository;
};

type RetryState = {
  content: string;
  conversationId: string | null;
  clientMessageId: string;
};

const AiContext = createContext<AiStateValue | null>(null);

function usageFromBootstrap(bootstrapData: BootstrapResponse | null): AiUsageResponse | null {
  const allowance = bootstrapData?.ai;
  if (!allowance) return null;
  return {
    limit: allowance.dailyMessageLimit,
    used: allowance.messagesUsedToday,
    remaining: allowance.remaining,
    resetsAt: allowance.resetsAt,
  };
}

function newClientMessageId() {
  return Crypto.randomUUID?.() ?? `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function userEchoMessage(clientMessageId: string, content: string): AiMessageResponse {
  return {
    id: clientMessageId,
    role: 'USER',
    content,
    recipeIds: [],
    safetyLabel: 'SAFE',
    createdAt: new Date().toISOString(),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'AI_DAILY_QUOTA_EXHAUSTED':
        return '今日 AI 次数已用完';
      case 'AI_RATE_LIMITED':
        return '发送太快了，稍后再试';
      case 'AI_PROVIDER_TIMEOUT':
        return '回复暂时没有生成，请稍后重试';
      case 'AI_PROVIDER_UNAVAILABLE':
        return 'AI 服务暂不可用，请稍后重试';
      case 'AI_ACCESS_SUSPENDED':
        return '账号暂不可使用 AI';
      case 'AI_FEATURE_DISABLED':
        return 'AI 功能暂未开放';
      case 'AGE_CONFIRMATION_REQUIRED':
        return '请先完成年龄确认';
      case 'VALIDATION_ERROR':
        return '输入内容不符合要求';
      default:
        return '请求失败，请稍后重试';
    }
  }
  return '请求失败，请稍后重试';
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function isQuotaExhausted(error: unknown) {
  return error instanceof ApiError && error.code === 'AI_DAILY_QUOTA_EXHAUSTED';
}

function boundedTemporaryContext(messages: AiMessageResponse[]): TemporaryContextMessage[] {
  const recent = messages.slice(-20);
  const bounded: TemporaryContextMessage[] = [];
  let remainingChars = 12_000;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    const size = message.role.length + message.content.length;
    if (size > remainingChars) break;
    bounded.unshift({ role: message.role, content: message.content });
    remainingChars -= size;
  }
  return bounded;
}

export function AiProvider({ children, repository: providedRepository }: AiProviderProps) {
  const auth = useAuth();
  const repository = useMemo(
    () => providedRepository ?? new AiRepository({ authenticatedClient: { request: auth.authenticatedRequest } }),
    [auth.authenticatedRequest, providedRepository]
  );
  const bootstrapUsage = useMemo(() => usageFromBootstrap(auth.bootstrapData), [auth.bootstrapData]);
  const bootstrapMemoryEnabled = auth.bootstrapData?.user.memoryEnabled ?? false;
  const [status, setStatus] = useState<AiViewStatus>('idle');
  const [mode, setMode] = useState<AiChatMode>('normal');
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<AiMessageResponse[]>([]);
  const [memories, setMemories] = useState<AiMemoryResponse[]>([]);
  const [memoryEnabled, setMemoryEnabledState] = useState(() => auth.bootstrapData?.user.memoryEnabled ?? false);
  const [usage, setUsage] = useState<AiUsageResponse | null>(() => usageFromBootstrap(auth.bootstrapData));
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastMemoryChanges, setLastMemoryChanges] = useState<MemoryChange[]>([]);
  const [pendingClientMessageId, setPendingClientMessageId] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const sendPromiseRef = useRef<Promise<void> | null>(null);
  const messagesRef = useRef<AiMessageResponse[]>([]);
  const selectedConversationRef = useRef<ConversationResponse | null>(null);
  const modeRef = useRef<AiChatMode>('normal');
  const retryRef = useRef<RetryState | null>(null);
  const repositoryRef = useRef(repository);
  const authRef = useRef(auth);

  useLayoutEffect(() => {
    messagesRef.current = messages;
    selectedConversationRef.current = selectedConversation;
    modeRef.current = mode;
    repositoryRef.current = repository;
    authRef.current = auth;
  }, [auth, messages, mode, repository, selectedConversation]);

  const resetRuntime = useCallback(() => {
    loadVersionRef.current += 1;
    sendPromiseRef.current = null;
    messagesRef.current = [];
    selectedConversationRef.current = null;
    modeRef.current = 'normal';
    retryRef.current = null;
    setStatus('idle');
    setMode('normal');
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    setMemories([]);
    setDraft('');
    setError(null);
    setLastMemoryChanges([]);
    setPendingClientMessageId(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      resetRuntime();
    };
  }, [resetRuntime]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsage(bootstrapUsage);
    setMemoryEnabledState(bootstrapMemoryEnabled);
  }, [bootstrapMemoryEnabled, bootstrapUsage]);

  useEffect(() => {
    // Session boundaries must immediately discard runtime-only AI text.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetRuntime();
    setUsage(bootstrapUsage);
    setMemoryEnabledState(bootstrapMemoryEnabled);
  }, [auth.session.generation, auth.session.userId, auth.status, bootstrapMemoryEnabled, bootstrapUsage, resetRuntime]);

  const applyError = useCallback(async (nextError: unknown) => {
    if (!isMountedRef.current) return;
    if (isQuotaExhausted(nextError)) {
      setUsage((current) => current ? { ...current, remaining: 0 } : current);
      setStatus('quotaExhausted');
    } else {
      setStatus('retryableError');
    }
    setError(errorMessage(nextError));
    if (isUnauthorized(nextError)) {
      await authRef.current.logout();
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (authRef.current.status !== 'signedIn') return;
    const loadVersion = ++loadVersionRef.current;
    setStatus('loadingHistory');
    setError(null);
    try {
      const [history, usageResponse] = await Promise.all([
        repositoryRef.current.listConversations({ page: 1, pageSize: 20 }),
        repositoryRef.current.getUsageToday(),
      ]);
      if (!isMountedRef.current || loadVersion !== loadVersionRef.current) return;
      setConversations(history.items);
      setUsage(usageResponse);
      setStatus(modeRef.current === 'temporary' ? 'temporary' : 'idle');
    } catch (nextError) {
      await applyError(nextError);
    }
  }, [applyError]);

  const selectConversation = useCallback(async (conversation: ConversationResponse) => {
    if (authRef.current.status !== 'signedIn') return;
    const loadVersion = ++loadVersionRef.current;
    modeRef.current = 'normal';
    setMode('normal');
    setSelectedConversation(conversation);
    setMessages([]);
    setDraft('');
    setError(null);
    setStatus('loadingConversation');
    try {
      const response = await repositoryRef.current.listMessages(conversation.id, { page: 1, pageSize: 50 });
      if (!isMountedRef.current || loadVersion !== loadVersionRef.current) return;
      selectedConversationRef.current = conversation;
      messagesRef.current = response.items;
      setSelectedConversation(conversation);
      setMessages(response.items);
      setStatus('idle');
      setPendingClientMessageId(null);
      retryRef.current = null;
    } catch (nextError) {
      await applyError(nextError);
    }
  }, [applyError]);

  const startNewChat = useCallback(() => {
    loadVersionRef.current += 1;
    modeRef.current = 'normal';
    selectedConversationRef.current = null;
    messagesRef.current = [];
    retryRef.current = null;
    setMode('normal');
    setSelectedConversation(null);
    setMessages([]);
    setDraft('');
    setError(null);
    setLastMemoryChanges([]);
    setPendingClientMessageId(null);
    setStatus('idle');
  }, []);

  const startTemporaryChat = useCallback(() => {
    loadVersionRef.current += 1;
    modeRef.current = 'temporary';
    selectedConversationRef.current = null;
    messagesRef.current = [];
    retryRef.current = null;
    setMode('temporary');
    setSelectedConversation(null);
    setMessages([]);
    setDraft('');
    setError(null);
    setLastMemoryChanges([]);
    setPendingClientMessageId(null);
    setStatus('temporary');
  }, []);

  const finishSend = useCallback((response: SendMessageResponse | TemporaryMessageResponse, userMessage?: AiMessageResponse) => {
    if (!isMountedRef.current) return;
    const nextMessages = 'userMessage' in response
      ? [response.userMessage, response.assistantMessage]
      : [userMessage!, response.assistantMessage];
    const mergedMessages = [...messagesRef.current, ...nextMessages];
    messagesRef.current = mergedMessages;
    setMessages(mergedMessages);
    setUsage(response.usage);
    setLastMemoryChanges(response.memoryChanges);
    setDraft('');
    setError(null);
    setPendingClientMessageId(null);
    retryRef.current = null;
    setStatus(modeRef.current === 'temporary' ? 'temporary' : 'idle');
    if ('conversation' in response) {
      selectedConversationRef.current = response.conversation;
      setSelectedConversation(response.conversation);
      setConversations((current) => {
        const withoutCurrent = current.filter((item) => item.id !== response.conversation.id);
        return [response.conversation, ...withoutCurrent];
      });
    }
  }, []);

  const performSend = useCallback(async (
    content: string,
    clientMessageId: string,
    existingConversationId: string | null
  ) => {
    setStatus('sending');
    setError(null);
    setPendingClientMessageId(clientMessageId);
    const currentMode = modeRef.current;
    try {
      if (currentMode === 'temporary') {
        const userMessage = userEchoMessage(clientMessageId, content);
        const response = await repositoryRef.current.sendTemporaryMessage({
          content,
          clientMessageId,
          context: boundedTemporaryContext(messagesRef.current),
        });
        if (!isMountedRef.current || modeRef.current !== 'temporary') return;
        finishSend(response, userMessage);
        return;
      }

      let conversationId = existingConversationId ?? selectedConversationRef.current?.id ?? null;
      if (!conversationId) {
        const conversation = await repositoryRef.current.createConversation();
        if (!isMountedRef.current || modeRef.current !== 'normal') return;
        conversationId = conversation.id;
        selectedConversationRef.current = conversation;
        setSelectedConversation(conversation);
        retryRef.current = { content, conversationId, clientMessageId };
      }

      const response = await repositoryRef.current.sendMessage(conversationId, { content, clientMessageId });
      if (!isMountedRef.current || modeRef.current !== 'normal') return;
      finishSend(response);
    } catch (nextError) {
      retryRef.current = {
        content,
        conversationId: currentMode === 'temporary' ? null : existingConversationId ?? selectedConversationRef.current?.id ?? null,
        clientMessageId,
      };
      setDraft(content);
      await applyError(nextError);
    }
  }, [applyError, finishSend]);

  const send = useCallback(async (content?: string, clientMessageId?: string) => {
    if (sendPromiseRef.current) return;
    const text = (content ?? draft).trim();
    if (!text || authRef.current.status !== 'signedIn') return;
    if (usage?.remaining === 0) {
      setStatus('quotaExhausted');
      setError('今日 AI 次数已用完');
      return;
    }
    const id = clientMessageId ?? newClientMessageId();
    retryRef.current = {
      content: text,
      conversationId: modeRef.current === 'normal' ? selectedConversationRef.current?.id ?? null : null,
      clientMessageId: id,
    };
    const promise = performSend(text, id, retryRef.current.conversationId).finally(() => {
      if (sendPromiseRef.current === promise) {
        sendPromiseRef.current = null;
      }
    });
    sendPromiseRef.current = promise;
    await promise;
  }, [draft, performSend, usage?.remaining]);

  const retry = useCallback(async () => {
    if (sendPromiseRef.current || !retryRef.current) return;
    const retryState = retryRef.current;
    const promise = performSend(
      retryState.content,
      retryState.clientMessageId,
      retryState.conversationId
    ).finally(() => {
      if (sendPromiseRef.current === promise) {
        sendPromiseRef.current = null;
      }
    });
    sendPromiseRef.current = promise;
    await promise;
  }, [performSend]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await repositoryRef.current.deleteConversation(conversationId);
    if (!isMountedRef.current) return;
    setConversations((current) => current.filter((item) => item.id !== conversationId));
    if (selectedConversationRef.current?.id === conversationId) {
      startNewChat();
    }
  }, [startNewChat]);

  const loadMemories = useCallback(async () => {
    try {
      const response = await repositoryRef.current.listMemories();
      if (!isMountedRef.current) return;
      setMemories(response.items);
      setError(null);
    } catch (nextError) {
      await applyError(nextError);
    }
  }, [applyError]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    try {
      await repositoryRef.current.deleteMemory(memoryId);
      if (!isMountedRef.current) return;
      setMemories((current) => current.filter((item) => item.id !== memoryId));
      setError(null);
    } catch (nextError) {
      await applyError(nextError);
    }
  }, [applyError]);

  const clearMemories = useCallback(async () => {
    try {
      await repositoryRef.current.clearMemories();
      if (!isMountedRef.current) return;
      setMemories([]);
      setError(null);
    } catch (nextError) {
      await applyError(nextError);
    }
  }, [applyError]);

  const setMemoryEnabled = useCallback(async (enabled: boolean) => {
    const previous = memoryEnabled;
    setMemoryEnabledState(enabled);
    try {
      const response = await repositoryRef.current.setMemoryEnabled(enabled);
      if (!isMountedRef.current) return;
      setMemoryEnabledState(response.enabled);
      setError(null);
    } catch (nextError) {
      if (isMountedRef.current) {
        setMemoryEnabledState(previous);
      }
      await applyError(nextError);
    }
  }, [applyError, memoryEnabled]);

  const value = useMemo<AiStateValue>(
    () => ({
      status,
      mode,
      conversations,
      selectedConversation,
      messages,
      memories,
      memoryEnabled,
      usage,
      draft,
      error,
      lastMemoryChanges,
      pendingClientMessageId,
      isReady: auth.status === 'signedIn',
      setDraft,
      loadConversations,
      selectConversation,
      startNewChat,
      startTemporaryChat,
      send,
      retry,
      deleteConversation,
      loadMemories,
      deleteMemory,
      clearMemories,
      setMemoryEnabled,
    }),
    [
      auth.status,
      clearMemories,
      conversations,
      deleteConversation,
      deleteMemory,
      draft,
      error,
      lastMemoryChanges,
      loadConversations,
      loadMemories,
      memories,
      memoryEnabled,
      messages,
      mode,
      pendingClientMessageId,
      retry,
      selectConversation,
      selectedConversation,
      send,
      setMemoryEnabled,
      startNewChat,
      startTemporaryChat,
      status,
      usage,
    ]
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiStateValue {
  const value = useContext(AiContext);
  if (!value) {
    throw new Error('useAi must be used within AiProvider');
  }
  return value;
}
