import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultInteractionState,
  loadInteractionState,
  saveInteractionState,
  toggleInteractionId,
} from '../interactionService';

describe('interactionService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads privacy-safe interaction defaults', async () => {
    await expect(loadInteractionState()).resolves.toEqual(defaultInteractionState);
  });

  it('toggles local interaction ids without duplicating values', () => {
    expect(toggleInteractionId(['a'], 'a')).toEqual([]);
    expect(toggleInteractionId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInteractionId(['a', 'a'], 'a')).toEqual([]);
  });

  it('persists interaction state locally and tolerates native storage failures', async () => {
    const state = {
      likedPostIds: ['post-1'],
      followedAuthorIds: ['author-1'],
      likedCellarCardIds: ['card-1'],
      favoriteVenueIds: ['venue-1'],
      localCommunityPosts: [],
      localPostComments: {},
      searchHistory: [],
      lastDrawDate: null,
      drawnCards: [],
    };

    await saveInteractionState(state);

    await expect(loadInteractionState()).resolves.toEqual(state);

    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('Native module is null'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('Native module is null'));

    await expect(loadInteractionState()).resolves.toEqual(defaultInteractionState);
    await expect(saveInteractionState(defaultInteractionState)).resolves.toBeUndefined();
  });
});
