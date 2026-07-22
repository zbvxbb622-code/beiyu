import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearInteractionState,
  defaultInteractionState,
  loadInteractionState,
  saveInteractionState,
  toggleInteractionId,
} from '@/services/interactionService';
import {
  clearLocalState,
  defaultLocalState,
  defaultUserProfile,
  loadLocalState,
  loadUserProfile,
  saveAgeVerified,
  saveCellarIngredientIds,
  savePrivacySettings,
  saveUserProfile,
} from '@/services/storageService';
import { canDrawToday, drawCard, todayKey } from '@/services/blindBoxService';
import { clearPostDraft } from '@/services/postDraftService';
import { deriveCoverImageKey } from '@/utils/postImages';
import type { BlindBoxCard, CommunityComment, CommunityPost, DrawnCardRecord, LocalInteractionState, LocalState, PostImage, PostVisibility, PrivacySettings, UserProfile } from '@/types/mixology';

type MixologyContextValue = {
  isHydrated: boolean;
  localState: LocalState;
  interactionState: LocalInteractionState;
  userProfile: UserProfile;
  updateUserProfile: (patch: Partial<UserProfile>) => Promise<void>;
  verifyAge: () => Promise<void>;
  toggleCellarIngredient: (ingredientId: string) => Promise<void>;
  setCellarIngredientIds: (ingredientIds: string[]) => Promise<void>;
  updatePrivacySettings: (settings: PrivacySettings) => Promise<void>;
  togglePostLike: (postId: string) => Promise<void>;
  toggleAuthorFollow: (authorId: string) => Promise<void>;
  toggleCellarCardLike: (cardId: string) => Promise<void>;
  toggleVenueFavorite: (venueId: string) => Promise<void>;
  addPostComment: (postId: string, text: string) => Promise<CommunityComment>;
  publishPost: (input: PublishPostInput) => Promise<CommunityPost>;
  addSearchHistory: (query: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  drawBlindBoxCard: () => Promise<BlindBoxCard>;
  resetLocalState: () => Promise<void>;
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

export function MixologyProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [localState, setLocalState] = useState<LocalState>(defaultLocalState);
  const [interactionState, setInteractionState] = useState<LocalInteractionState>(defaultInteractionState);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadLocalState(), loadInteractionState(), loadUserProfile()])
      .then(([storedLocalState, storedInteractionState, storedUserProfile]) => {
        if (isMounted) {
          setLocalState(storedLocalState);
          setInteractionState(storedInteractionState);
          setUserProfile(storedUserProfile);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateUserProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const next = { ...userProfile, ...patch };
      setUserProfile(next);
      await saveUserProfile(next);
    },
    [userProfile]
  );

  const verifyAge = useCallback(async () => {
    setLocalState((state) => ({ ...state, ageVerified: true }));
    await saveAgeVerified(true);
  }, []);

  const setCellarIngredientIds = useCallback(async (ingredientIds: string[]) => {
    const uniqueIds = Array.from(new Set(ingredientIds));
    setLocalState((state) => ({ ...state, cellarIngredientIds: uniqueIds }));
    await saveCellarIngredientIds(uniqueIds);
  }, []);

  const toggleCellarIngredient = useCallback(
    async (ingredientId: string) => {
      const current = new Set(localState.cellarIngredientIds);
      if (current.has(ingredientId)) {
        current.delete(ingredientId);
      } else {
        current.add(ingredientId);
      }
      await setCellarIngredientIds(Array.from(current));
    },
    [localState.cellarIngredientIds, setCellarIngredientIds]
  );

  const updatePrivacySettings = useCallback(async (privacySettings: PrivacySettings) => {
    setLocalState((state) => ({ ...state, privacySettings }));
    await savePrivacySettings(privacySettings);
  }, []);

  const updateInteractions = useCallback(async (updater: (state: LocalInteractionState) => LocalInteractionState) => {
    const nextState = updater(interactionState);
    setInteractionState(nextState);
    await saveInteractionState(nextState);
  }, [interactionState]);

  const togglePostLike = useCallback(
    async (postId: string) => {
      await updateInteractions((state) => ({
        ...state,
        likedPostIds: toggleInteractionId(state.likedPostIds, postId),
      }));
    },
    [updateInteractions]
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

  const addPostComment = useCallback(
    async (postId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error('评论内容不能为空');
      }
      const comment: CommunityComment = {
        id: `local-comment-${Date.now()}`,
        authorName: userProfile.nickname,
        authorAvatarKey: userProfile.avatarKey,
        text: trimmed,
        date: new Date().toISOString().slice(0, 10),
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
    [updateInteractions, userProfile]
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
    [updateInteractions, userProfile]
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
    if (!canDrawToday(interactionState.lastDrawDate)) {
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
  }, [interactionState.lastDrawDate, updateInteractions]);

  const resetLocalState = useCallback(async () => {
    await Promise.all([clearLocalState(), clearInteractionState(), clearPostDraft()]);
    setLocalState(defaultLocalState);
    setInteractionState(defaultInteractionState);
    setUserProfile(defaultUserProfile);
  }, []);

  const value = useMemo(
    () => ({
      isHydrated,
      localState,
      interactionState,
      userProfile,
      updateUserProfile,
      verifyAge,
      toggleCellarIngredient,
      setCellarIngredientIds,
      updatePrivacySettings,
      togglePostLike,
      toggleAuthorFollow,
      toggleCellarCardLike,
      toggleVenueFavorite,
      addPostComment,
      publishPost,
      addSearchHistory,
      clearSearchHistory,
      drawBlindBoxCard,
      resetLocalState,
    }),
    [
      isHydrated,
      localState,
      interactionState,
      userProfile,
      updateUserProfile,
      verifyAge,
      toggleCellarIngredient,
      setCellarIngredientIds,
      updatePrivacySettings,
      togglePostLike,
      toggleAuthorFollow,
      toggleCellarCardLike,
      toggleVenueFavorite,
      addPostComment,
      publishPost,
      addSearchHistory,
      clearSearchHistory,
      drawBlindBoxCard,
      resetLocalState,
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
