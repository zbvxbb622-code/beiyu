import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LocalInteractionState } from '@/types/mixology';

const INTERACTION_KEY = 'mixology.interactionState';

export const defaultInteractionState: LocalInteractionState = {
  likedPostIds: [],
  followedAuthorIds: [],
  likedCellarCardIds: [],
  favoriteVenueIds: [],
  localCommunityPosts: [],
  localPostComments: {},
  searchHistory: [],
  lastDrawDate: null,
  drawnCards: [],
};

export function toggleInteractionId(ids: string[], id: string) {
  const uniqueIds = new Set(ids);

  if (uniqueIds.has(id)) {
    uniqueIds.delete(id);
  } else {
    uniqueIds.add(id);
  }

  return Array.from(uniqueIds);
}

export async function loadInteractionState(): Promise<LocalInteractionState> {
  let rawValue: string | null;

  try {
    rawValue = await AsyncStorage.getItem(INTERACTION_KEY);
  } catch {
    return defaultInteractionState;
  }

  if (!rawValue) {
    return defaultInteractionState;
  }

  try {
    return {
      ...defaultInteractionState,
      ...(JSON.parse(rawValue) as Partial<LocalInteractionState>),
    };
  } catch {
    return defaultInteractionState;
  }
}

export async function saveInteractionState(interactionState: LocalInteractionState) {
  try {
    await AsyncStorage.setItem(INTERACTION_KEY, JSON.stringify(interactionState));
  } catch {
    // Keep the prototype usable when native storage is unavailable in Expo Go.
  }
}

export async function clearInteractionState() {
  try {
    await AsyncStorage.removeItem(INTERACTION_KEY);
  } catch {
    // Keep the prototype usable when native storage is unavailable in Expo Go.
  }
}
