import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  clearInteractionState,
  defaultInteractionState,
  loadInteractionState,
  saveInteractionState,
  toggleInteractionId,
} from '@/services/interactionService';
import {
  clearLocalState,
  anonymousAccountSecurity,
  defaultLocalState,
  defaultUserProfile,
  loadGuestState,
  saveAuthenticatedState,
  saveGuestState,
} from '@/services/storageService';
import type { BootstrapResponse } from '@/services/auth/authSchemas';
import { useAuth } from '@/state/AuthState';
import { canDrawToday, drawCard, todayKey } from '@/services/blindBoxService';
import { clearPostDraft } from '@/services/postDraftService';
import { deriveCoverImageKey } from '@/utils/postImages';
import type { AccountSecurity, BlindBoxCard, CommunityComment, CommunityPost, DrawnCardRecord, LocalInteractionState, LocalState, PostImage, PostVisibility, PrivacySettings, UserProfile } from '@/types/mixology';

type MixologyContextValue = {
  isHydrated: boolean;
  localState: LocalState;
  interactionState: LocalInteractionState;
  userProfile: UserProfile;
  accountSecurity: AccountSecurity;
  applyBootstrap: (response: BootstrapResponse) => Promise<void>;
  updateUserProfile: (patch: Partial<UserProfile>) => Promise<void>;
  verifyAge: () => Promise<void>;
  toggleCellarIngredient: (ingredientId: string) => Promise<void>;
  setCellarIngredientIds: (ingredientIds: string[]) => Promise<void>;
  updatePrivacySettings: (settings: PrivacySettings) => Promise<void>;
  togglePostLike: (postId: string) => Promise<void>;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  toggleAuthorFollow: (authorId: string) => Promise<void>;
  toggleCellarCardLike: (cardId: string) => Promise<void>;
  toggleVenueFavorite: (venueId: string) => Promise<void>;
  refreshCommunityPosts: () => Promise<void>;
  addPostComment: (postId: string, text: string, parentCommentId?: string) => Promise<CommunityComment>;
  publishPost: (input: PublishPostInput) => Promise<CommunityPost>;
  deletePost: (postId: string) => Promise<void>;
  addSearchHistory: (query: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  drawBlindBoxCard: () => Promise<BlindBoxCard>;
  resetLocalState: () => Promise<void>;
  logout: () => Promise<void>;
  updateAccountSecurity: (patch: Partial<AccountSecurity>) => Promise<void>;
  bindWechat: () => Promise<void>;
  unbindWechat: () => Promise<void>;
  setPassword: () => Promise<void>;
  setPhone: (phone: string) => Promise<void>;
  verifyRealname: (name: string) => Promise<void>;
  verifyOfficial: (officialType: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

export type PublishPostInput = {
  title: string;
  body: string;
  imageKey?: string;
  venueId?: string;
  category?: CommunityPost['category'];
  images?: PostImage[];
  topics?: string[];
  visibility?: PostVisibility;
  allowComments?: boolean;
};

const MixologyContext = createContext<MixologyContextValue | null>(null);

function accountSecurityFromBootstrap(response: BootstrapResponse): AccountSecurity {
  return {
    phone: response.accountSecurity.phone,
    phoneVerified: response.accountSecurity.phoneVerified,
    wechatBound: response.accountSecurity.wechatBound ?? false,
    wechatAccount: response.accountSecurity.wechatAccount ?? '',
    passwordSet: response.accountSecurity.passwordSet ?? false,
    realnameVerified: response.accountSecurity.realnameVerified ?? false,
    realnameName: '',
    officialVerified: response.accountSecurity.officialVerified ?? false,
    officialType: response.accountSecurity.officialType ?? '',
    devices: response.accountSecurity.devices.map((device) => ({
      id: device.id,
      name: device.name,
      platform: device.platform === 'IOS' ? 'iOS' : device.platform === 'ANDROID' ? 'Android' : 'Web',
      lastActive: device.lastActiveAt,
      isCurrent: device.isCurrent,
    })),
  };
}

function cellarIngredientIdsFromBootstrap(response: BootstrapResponse): string[] {
  return Array.from(new Set(response.cellar.items.flatMap((item) => item.ingredientId ? [item.ingredientId] : [])));
}

function accountScopeKey(userId: string | null, generation: number) {
  return userId ? `user:${userId}:${generation}` : `guest:${generation}`;
}

export function MixologyProvider({ children }: { children: ReactNode }) {
  const { bootstrapData, repository, session, status } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const [localState, setLocalState] = useState<LocalState>(defaultLocalState);
  const [interactionState, setInteractionState] = useState<LocalInteractionState>(defaultInteractionState);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);
  const [accountSecurity, setAccountSecurity] = useState<AccountSecurity>(anonymousAccountSecurity);
  const [visibleAccountScope, setVisibleAccountScope] = useState('guest:0');
  const interactionStateRef = useRef<LocalInteractionState>(defaultInteractionState);
  const localStateRef = useRef<LocalState>(defaultLocalState);
  const userProfileRef = useRef<UserProfile>(defaultUserProfile);
  const accountSecurityRef = useRef<AccountSecurity>(anonymousAccountSecurity);
  const cellarIngredientIdsRef = useRef<string[]>(defaultLocalState.cellarIngredientIds);
  const cellarMutationVersionRef = useRef(0);
  const cellarMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const profileMutationVersionRef = useRef(0);
  const privacyMutationVersionRef = useRef(0);
  const authRef = useRef({ status, session, bootstrapData });

  useLayoutEffect(() => {
    authRef.current = { status, session, bootstrapData };
  }, [bootstrapData, session, status]);

  useEffect(() => {
    let isMounted = true;
    loadInteractionState().then((storedInteractionState) => {
      if (!isMounted) return;
      interactionStateRef.current = storedInteractionState;
      setInteractionState(storedInteractionState);
    }).finally(() => {
      if (isMounted) setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const sessionGeneration = session?.generation ?? 0;
  const sessionUserId = session?.userId ?? bootstrapData?.user.id ?? null;
  const activeAccountScope = accountScopeKey(status === 'signedIn' ? sessionUserId : null, sessionGeneration);
  const accountStateIsVisible = session === undefined
    ? visibleAccountScope === activeAccountScope || visibleAccountScope.startsWith('user:')
    : visibleAccountScope === activeAccountScope;

  const resetAccountState = useCallback(() => {
    localStateRef.current = defaultLocalState;
    userProfileRef.current = defaultUserProfile;
    accountSecurityRef.current = anonymousAccountSecurity;
    cellarIngredientIdsRef.current = [];
    cellarMutationVersionRef.current += 1;
    cellarMutationQueueRef.current = Promise.resolve();
    setLocalState(defaultLocalState);
    setUserProfile(defaultUserProfile);
    setAccountSecurity(anonymousAccountSecurity);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Session boundaries must synchronously hide the previous account before loading the next scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetAccountState();
    if (status !== 'signedOut') return () => { cancelled = true; };

    void loadGuestState().then(({ localState: guestState, userProfile: guestProfile }) => {
      if (cancelled || authRef.current.status !== 'signedOut') return;
      localStateRef.current = guestState;
      userProfileRef.current = guestProfile;
      cellarIngredientIdsRef.current = guestState.cellarIngredientIds;
      setLocalState(guestState);
      setUserProfile(guestProfile);
      setVisibleAccountScope(accountScopeKey(null, sessionGeneration));
    });
    return () => { cancelled = true; };
  }, [resetAccountState, sessionGeneration, sessionUserId, status]);

  const captureSession = useCallback(() => {
    const auth = authRef.current;
    if (auth.status !== 'signedIn') return null;
    return {
      userId: auth.session?.userId ?? auth.bootstrapData?.user.id ?? '__test-session__',
      generation: auth.session?.generation ?? 0,
    };
  }, []);

  const isSessionActive = useCallback((expected: { userId: string; generation: number }) => {
    const active = captureSession();
    return active?.userId === expected.userId && active.generation === expected.generation;
  }, [captureSession]);

  const saveCurrentAccountState = useCallback(async (expected: { userId: string; generation: number }) => {
    if (!isSessionActive(expected)) return;
    await saveAuthenticatedState({
      userId: expected.userId,
      localState: localStateRef.current,
      userProfile: userProfileRef.current,
      accountSecurity: accountSecurityRef.current,
    });
  }, [isSessionActive]);

  const applyBootstrap = useCallback(async (response: BootstrapResponse) => {
    const auth = authRef.current;
    const requiresSessionGuard = auth.session !== undefined;
    const expected = {
      userId: response.user.id,
      generation: auth.session?.generation ?? 0,
    };
    if (requiresSessionGuard && (!isSessionActive(expected) || auth.session?.userId !== response.user.id)) {
      return;
    }

    const nextLocalState: LocalState = {
      ageVerified: response.user.ageConfirmed,
      cellarIngredientIds: cellarIngredientIdsFromBootstrap(response),
      privacySettings: response.privacy,
    };
    const nextProfile: UserProfile = response.profile;
    const nextAccountSecurity = accountSecurityFromBootstrap(response);
    if (requiresSessionGuard && !isSessionActive(expected)) return;
    await saveAuthenticatedState({
      userId: response.user.id,
      localState: nextLocalState,
      userProfile: nextProfile,
      accountSecurity: nextAccountSecurity,
    });
    if (requiresSessionGuard && !isSessionActive(expected)) {
      return;
    }

    localStateRef.current = nextLocalState;
    cellarIngredientIdsRef.current = nextLocalState.cellarIngredientIds;
    userProfileRef.current = nextProfile;
    accountSecurityRef.current = nextAccountSecurity;
    setLocalState(nextLocalState);
    setUserProfile(nextProfile);
    setAccountSecurity(nextAccountSecurity);
    setVisibleAccountScope(accountScopeKey(response.user.id, expected.generation));
  }, [isSessionActive]);

  const updateUserProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const expected = captureSession();
      if (!expected) {
        const next = { ...userProfileRef.current, ...patch };
        userProfileRef.current = next;
        setUserProfile(next);
        await saveGuestState(localStateRef.current, next);
        return;
      }
      const mutationVersion = ++profileMutationVersionRef.current;
      const next = await repository.patchProfile(patch);
      if (!isSessionActive(expected) || mutationVersion !== profileMutationVersionRef.current) return;
      userProfileRef.current = next;
      setUserProfile(next);
      await saveCurrentAccountState(expected);
    },
    [captureSession, isSessionActive, repository, saveCurrentAccountState]
  );

  const verifyAge = useCallback(async () => {
    const expected = captureSession();
    if (expected) {
      await repository.confirmAge();
      if (!isSessionActive(expected)) return;
    }
    const next = { ...localStateRef.current, ageVerified: true };
    localStateRef.current = next;
    setLocalState(next);
    if (expected) {
      await saveCurrentAccountState(expected);
    } else {
      await saveGuestState(next, userProfileRef.current);
    }
  }, [captureSession, isSessionActive, repository, saveCurrentAccountState]);

  const setCellarIngredientIds = useCallback(async (ingredientIds: string[]) => {
    const uniqueIds = Array.from(new Set(ingredientIds));
    const expected = captureSession();
    if (!expected) {
      const next = { ...localStateRef.current, cellarIngredientIds: uniqueIds };
      localStateRef.current = next;
      cellarIngredientIdsRef.current = uniqueIds;
      setLocalState(next);
      await saveGuestState(next, userProfileRef.current);
      return;
    }

    cellarIngredientIdsRef.current = uniqueIds;
    const mutationVersion = ++cellarMutationVersionRef.current;
    const mutation = cellarMutationQueueRef.current.then(async () => {
      if (!isSessionActive(expected)) return;
      const response = await repository.batchCellarItems(uniqueIds);
      if (!isSessionActive(expected) || mutationVersion !== cellarMutationVersionRef.current) return;
      const serverIngredientIds = Array.from(new Set(
        response.items.flatMap((item) => item.ingredientId ? [item.ingredientId] : [])
      ));
      const next = { ...localStateRef.current, cellarIngredientIds: serverIngredientIds };
      localStateRef.current = next;
      if (mutationVersion === cellarMutationVersionRef.current) {
        cellarIngredientIdsRef.current = serverIngredientIds;
      }
      setLocalState(next);
      await saveCurrentAccountState(expected);
    });
    cellarMutationQueueRef.current = mutation.catch(() => {
      if (isSessionActive(expected) && mutationVersion === cellarMutationVersionRef.current) {
        cellarIngredientIdsRef.current = localStateRef.current.cellarIngredientIds;
      }
    });
    await mutation;
  }, [captureSession, isSessionActive, repository, saveCurrentAccountState]);

  const toggleCellarIngredient = useCallback(
    async (ingredientId: string) => {
      const current = new Set(cellarIngredientIdsRef.current);
      if (current.has(ingredientId)) {
        current.delete(ingredientId);
      } else {
        current.add(ingredientId);
      }
      await setCellarIngredientIds(Array.from(current));
    },
    [setCellarIngredientIds]
  );

  const updatePrivacySettings = useCallback(async (privacySettings: PrivacySettings) => {
    const expected = captureSession();
    if (!expected) {
      const next = { ...localStateRef.current, privacySettings };
      localStateRef.current = next;
      setLocalState(next);
      await saveGuestState(next, userProfileRef.current);
      return;
    }
    const mutationVersion = ++privacyMutationVersionRef.current;
    const nextPrivacySettings = await repository.patchPrivacy(privacySettings);
    if (!isSessionActive(expected) || mutationVersion !== privacyMutationVersionRef.current) return;
    const next = { ...localStateRef.current, privacySettings: nextPrivacySettings };
    localStateRef.current = next;
    setLocalState(next);
    await saveCurrentAccountState(expected);
  }, [captureSession, isSessionActive, repository, saveCurrentAccountState]);

  const updateInteractions = useCallback(async (updater: (state: LocalInteractionState) => LocalInteractionState) => {
    const nextState = updater(interactionStateRef.current);
    interactionStateRef.current = nextState;
    setInteractionState(nextState);
    await saveInteractionState(nextState);
  }, []);

  const commitRemoteCommunityState = useCallback((updater: (state: LocalInteractionState) => LocalInteractionState) => {
    const nextState = updater(interactionStateRef.current);
    interactionStateRef.current = nextState;
    setInteractionState(nextState);
  }, []);

  const togglePostLike = useCallback(
    async (postId: string) => {
      const expected = captureSession();
      const remotePost = expected
        ? interactionStateRef.current.localCommunityPosts.find((post) => post.id === postId)
        : undefined;
      if (expected && remotePost?.likedByMe !== undefined) {
        const nextPost = remotePost.likedByMe
          ? await repository.unlikeCommunityPost(postId)
          : await repository.likeCommunityPost(postId);
        if (!isSessionActive(expected)) return;
        commitRemoteCommunityState((state) => ({
          ...state,
          localCommunityPosts: state.localCommunityPosts.map((post) => post.id === postId ? nextPost : post),
        }));
        return;
      }
      await updateInteractions((state) => ({
        ...state,
        likedPostIds: toggleInteractionId(state.likedPostIds, postId),
      }));
    },
    [captureSession, commitRemoteCommunityState, isSessionActive, repository, updateInteractions]
  );

  const replaceCommentInPost = useCallback((postId: string, comment: CommunityComment) => {
    commitRemoteCommunityState((state) => ({
      ...state,
      localCommunityPosts: state.localCommunityPosts.map((post) => post.id === postId
        ? {
            ...post,
            comments: post.comments.map((item) => item.id === comment.id ? comment : item),
          }
        : post),
    }));
  }, [commitRemoteCommunityState]);

  const toggleCommentLike = useCallback(
    async (postId: string, commentId: string) => {
      const expected = captureSession();
      const remotePost = expected
        ? interactionStateRef.current.localCommunityPosts.find((post) => post.id === postId)
        : undefined;
      const remoteComment = remotePost?.comments.find((comment) => comment.id === commentId);
      if (expected && remotePost?.likedByMe !== undefined && remoteComment) {
        const nextComment = remoteComment.likedByMe
          ? await repository.unlikeCommunityComment(commentId)
          : await repository.likeCommunityComment(commentId);
        if (!isSessionActive(expected)) return;
        replaceCommentInPost(postId, nextComment);
        return;
      }
      await updateInteractions((state) => ({
        ...state,
        localPostComments: {
          ...state.localPostComments,
          [postId]: (state.localPostComments[postId] ?? []).map((comment) => {
            if (comment.id !== commentId) return comment;
            const likedByMe = !comment.likedByMe;
            return {
              ...comment,
              likedByMe,
              likes: Math.max((comment.likes ?? 0) + (likedByMe ? 1 : -1), 0),
            };
          }),
        },
      }));
    },
    [captureSession, isSessionActive, replaceCommentInPost, repository, updateInteractions]
  );

  const toggleAuthorFollow = useCallback(
    async (authorId: string) => {
      await updateInteractions((state) => ({
        ...state,
        followedAuthorIds: toggleInteractionId(state.followedAuthorIds, authorId),
      }));
    },
    [updateInteractions]
  );

  const toggleCellarCardLike = useCallback(
    async (cardId: string) => {
      await updateInteractions((state) => ({
        ...state,
        likedCellarCardIds: toggleInteractionId(state.likedCellarCardIds, cardId),
      }));
    },
    [updateInteractions]
  );

  const toggleVenueFavorite = useCallback(
    async (venueId: string) => {
      await updateInteractions((state) => ({
        ...state,
        favoriteVenueIds: toggleInteractionId(state.favoriteVenueIds, venueId),
      }));
    },
    [updateInteractions]
  );

  const refreshCommunityPosts = useCallback(async () => {
    const expected = captureSession();
    if (!expected) return;
    const response = await repository.listCommunityPosts();
    if (!isSessionActive(expected)) return;
    commitRemoteCommunityState((state) => ({
      ...state,
      localCommunityPosts: response.items,
    }));
  }, [captureSession, commitRemoteCommunityState, isSessionActive, repository]);

  useEffect(() => {
    if (!isHydrated || status !== 'signedIn') return;
    void refreshCommunityPosts().catch(() => undefined);
  }, [isHydrated, refreshCommunityPosts, status]);

  const addPostComment = useCallback(
    async (postId: string, text: string, parentCommentId?: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error('评论内容不能为空');
      }
      const expected = captureSession();
      const remotePost = expected
        ? interactionStateRef.current.localCommunityPosts.find((post) => post.id === postId)
        : undefined;
      if (expected && remotePost?.likedByMe !== undefined) {
        const comment = await repository.addCommunityComment(postId, trimmed, parentCommentId);
        if (!isSessionActive(expected)) return comment;
        commitRemoteCommunityState((state) => ({
          ...state,
          localCommunityPosts: state.localCommunityPosts.map((post) => post.id === postId
            ? { ...post, comments: [...post.comments, comment] }
            : post),
        }));
        return comment;
      }
      const comment: CommunityComment = {
        id: `local-comment-${Date.now()}`,
        parentId: parentCommentId,
        authorName: userProfile.nickname,
        authorAvatarKey: userProfile.avatarKey,
        text: trimmed,
        date: new Date().toISOString().slice(0, 10),
        likes: 0,
        likedByMe: false,
      };
      await updateInteractions((state) => ({
        ...state,
        localPostComments: {
          ...state.localPostComments,
          [postId]: [...(state.localPostComments[postId] ?? []), comment],
        },
      }));
      return comment;
    },
    [captureSession, commitRemoteCommunityState, isSessionActive, repository, updateInteractions, userProfile]
  );

  const publishPost = useCallback(
    async (input: PublishPostInput) => {
      const title = input.title.trim();
      const body = input.body.trim();
      if (!title) {
        throw new Error('标题不能为空');
      }
      if (!body) {
        throw new Error('正文不能为空');
      }
      const images = input.images?.length
        ? input.images
        : input.imageKey
          ? [{ id: 'cover', kind: 'asset', assetKey: input.imageKey } as PostImage]
          : [];
      const expected = captureSession();
      if (expected) {
        const post = await repository.createCommunityPost({
          title,
          body,
          category: input.category ?? 'recommended',
          imageKey: input.imageKey ?? deriveCoverImageKey(images),
          images: images.length ? images : undefined,
          topics: input.topics?.length ? input.topics : undefined,
          venueId: input.venueId,
          visibility: input.visibility ?? 'public',
          allowComments: input.allowComments ?? true,
        });
        if (!isSessionActive(expected)) return post;
        commitRemoteCommunityState((state) => ({
          ...state,
          localCommunityPosts: [post, ...state.localCommunityPosts.filter((item) => item.id !== post.id)],
        }));
        return post;
      }
      const post: CommunityPost = {
        id: `local-post-${Date.now()}`,
        category: input.category ?? 'recommended',
        title,
        authorId: 'local-user',
        authorName: userProfile.nickname,
        authorAvatarKey: userProfile.avatarKey,
        imageKey: input.imageKey ?? deriveCoverImageKey(images),
        body,
        date: new Date().toISOString().slice(0, 10),
        likes: 0,
        comments: [],
        venueId: input.venueId,
        images: images.length ? images : undefined,
        topics: input.topics?.length ? input.topics : undefined,
        visibility: input.visibility ?? 'public',
        allowComments: input.allowComments ?? true,
      };
      await updateInteractions((state) => ({
        ...state,
        localCommunityPosts: [post, ...state.localCommunityPosts],
      }));
      return post;
    },
    [captureSession, commitRemoteCommunityState, isSessionActive, repository, updateInteractions, userProfile]
  );

  const removePostFromInteractionState = useCallback((postId: string) => (state: LocalInteractionState): LocalInteractionState => {
    const { [postId]: _removedComments, ...localPostComments } = state.localPostComments;
    return {
      ...state,
      likedPostIds: state.likedPostIds.filter((id) => id !== postId),
      localCommunityPosts: state.localCommunityPosts.filter((post) => post.id !== postId),
      localPostComments,
    };
  }, []);

  const deletePost = useCallback(
    async (postId: string) => {
      const expected = captureSession();
      const remotePost = expected
        ? interactionStateRef.current.localCommunityPosts.find((post) => post.id === postId)
        : undefined;
      if (expected && remotePost?.likedByMe !== undefined) {
        await repository.deleteCommunityPost(postId);
        if (!isSessionActive(expected)) return;
        commitRemoteCommunityState(removePostFromInteractionState(postId));
        return;
      }
      await updateInteractions(removePostFromInteractionState(postId));
    },
    [captureSession, commitRemoteCommunityState, isSessionActive, removePostFromInteractionState, repository, updateInteractions]
  );

  const addSearchHistory = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      await updateInteractions((state) => {
        const rest = state.searchHistory.filter((item) => item !== q);
        return { ...state, searchHistory: [q, ...rest].slice(0, 10) };
      });
    },
    [updateInteractions]
  );

  const clearSearchHistory = useCallback(async () => {
    await updateInteractions((state) => ({ ...state, searchHistory: [] }));
  }, [updateInteractions]);

  const drawBlindBoxCard = useCallback(async (): Promise<BlindBoxCard> => {
    if (!canDrawToday(interactionStateRef.current.lastDrawDate)) {
      throw new Error('今天已经抽过了，明天再来吧');
    }
    const card = drawCard();
    const record: DrawnCardRecord = { card, drawnAt: new Date().toISOString() };
    await updateInteractions((state) => ({
      ...state,
      lastDrawDate: todayKey(),
      drawnCards: [record, ...state.drawnCards],
    }));
    return card;
  }, [updateInteractions]);

  const resetLocalState = useCallback(async () => {
    await Promise.all([clearLocalState(), clearInteractionState(), clearPostDraft()]);
    localStateRef.current = defaultLocalState;
    cellarIngredientIdsRef.current = defaultLocalState.cellarIngredientIds;
    userProfileRef.current = defaultUserProfile;
    setLocalState(defaultLocalState);
    interactionStateRef.current = defaultInteractionState;
    setInteractionState(defaultInteractionState);
    setUserProfile(defaultUserProfile);
    setAccountSecurity(anonymousAccountSecurity);
    await saveGuestState(defaultLocalState, defaultUserProfile);
  }, []);

  const logout = useCallback(async () => {
    resetAccountState();
  }, [resetAccountState]);

  const commitAccountSecurity = useCallback(async (next: AccountSecurity) => {
    const expected = captureSession();
    if (!expected || !isSessionActive(expected)) return;
    accountSecurityRef.current = next;
    setAccountSecurity(next);
    await saveCurrentAccountState(expected);
  }, [captureSession, isSessionActive, saveCurrentAccountState]);

  const updateAccountSecurity = useCallback(
    async (patch: Partial<AccountSecurity>) => {
      await commitAccountSecurity({ ...accountSecurityRef.current, ...patch });
    },
    [commitAccountSecurity]
  );

  const bindWechat = useCallback(async () => {
    const next: AccountSecurity = {
      ...accountSecurityRef.current,
      wechatBound: true,
      wechatAccount: 'wxid_7f3a9c2b',
    };
    await commitAccountSecurity(next);
  }, [commitAccountSecurity]);

  const unbindWechat = useCallback(async () => {
    const next: AccountSecurity = {
      ...accountSecurityRef.current,
      wechatBound: false,
      wechatAccount: '',
    };
    await commitAccountSecurity(next);
  }, [commitAccountSecurity]);

  const setPassword = useCallback(async () => {
    await commitAccountSecurity({ ...accountSecurityRef.current, passwordSet: true });
  }, [commitAccountSecurity]);

  const setPhone = useCallback(
    async (phone: string) => {
      await commitAccountSecurity({ ...accountSecurityRef.current, phone, phoneVerified: true });
    },
    [commitAccountSecurity]
  );

  const verifyRealname = useCallback(
    async () => {
      const next: AccountSecurity = {
        ...accountSecurityRef.current,
        realnameVerified: true,
        realnameName: '',
      };
      await commitAccountSecurity(next);
    },
    [commitAccountSecurity]
  );

  const verifyOfficial = useCallback(
    async (officialType: string) => {
      const next: AccountSecurity = {
        ...accountSecurityRef.current,
        officialVerified: true,
        officialType,
      };
      await commitAccountSecurity(next);
    },
    [commitAccountSecurity]
  );

  const removeDevice = useCallback(
    async (deviceId: string) => {
      const next: AccountSecurity = {
        ...accountSecurityRef.current,
        devices: accountSecurityRef.current.devices.filter((device) => device.id !== deviceId),
      };
      await commitAccountSecurity(next);
    },
    [commitAccountSecurity]
  );

  const deleteAccount = useCallback(async () => {
    resetAccountState();
  }, [resetAccountState]);

  const value = useMemo(
    () => ({
      isHydrated,
      localState: accountStateIsVisible ? localState : defaultLocalState,
      interactionState,
      userProfile: accountStateIsVisible ? userProfile : defaultUserProfile,
      applyBootstrap,
      updateUserProfile,
      verifyAge,
      toggleCellarIngredient,
      setCellarIngredientIds,
      updatePrivacySettings,
      togglePostLike,
      toggleCommentLike,
      toggleAuthorFollow,
      toggleCellarCardLike,
      toggleVenueFavorite,
      refreshCommunityPosts,
      addPostComment,
      publishPost,
      deletePost,
      addSearchHistory,
      clearSearchHistory,
      drawBlindBoxCard,
      resetLocalState,
      logout,
      accountSecurity: accountStateIsVisible ? accountSecurity : anonymousAccountSecurity,
      updateAccountSecurity,
      bindWechat,
      unbindWechat,
      setPassword,
      setPhone,
      verifyRealname,
      verifyOfficial,
      removeDevice,
      deleteAccount,
    }),
    [
      isHydrated,
      localState,
      interactionState,
      userProfile,
      accountStateIsVisible,
      applyBootstrap,
      updateUserProfile,
      verifyAge,
      toggleCellarIngredient,
      setCellarIngredientIds,
      updatePrivacySettings,
      togglePostLike,
      toggleCommentLike,
      toggleAuthorFollow,
      toggleCellarCardLike,
      toggleVenueFavorite,
      refreshCommunityPosts,
      addPostComment,
      publishPost,
      deletePost,
      addSearchHistory,
      clearSearchHistory,
      drawBlindBoxCard,
      resetLocalState,
      logout,
      accountSecurity,
      updateAccountSecurity,
      bindWechat,
      unbindWechat,
      setPassword,
      setPhone,
      verifyRealname,
      verifyOfficial,
      removeDevice,
      deleteAccount,
    ]
  );

  return <MixologyContext.Provider value={value}>{children}</MixologyContext.Provider>;
}

export function useMixology() {
  const value = useContext(MixologyContext);

  if (!value) {
    throw new Error('useMixology must be used inside MixologyProvider');
  }

  return value;
}
