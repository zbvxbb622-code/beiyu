import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { MixologyProvider, useMixology } from '@/state/MixologyState';

type MixologyValue = ReturnType<typeof useMixology>;

let currentValue: MixologyValue | null = null;

function Probe() {
  const value = useMixology();

  useEffect(() => {
    currentValue = value;
  }, [value]);

  return <Text>{value.isHydrated ? 'hydrated' : 'loading'}</Text>;
}

describe('MixologyProvider', () => {
  beforeEach(async () => {
    currentValue = null;
    await AsyncStorage.clear();
  });

  it('preserves rapid interaction updates from the same rendered snapshot', async () => {
    const screen = await render(
      <MixologyProvider>
        <Probe />
      </MixologyProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('hydrated')).toBeTruthy();
    });

    const snapshot = currentValue;
    expect(snapshot).not.toBeNull();

    await act(async () => {
      await Promise.all([
        snapshot!.togglePostLike('post-1'),
        snapshot!.toggleAuthorFollow('author-1'),
      ]);
    });

    await waitFor(() => {
      expect(currentValue?.interactionState.likedPostIds).toEqual(['post-1']);
      expect(currentValue?.interactionState.followedAuthorIds).toEqual(['author-1']);
    });
  });
});
