import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import CellarIngredientsScreen from '@/app/cellar-ingredients';

const mockToggle = jest.fn<() => Promise<void>>();

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    localState: { cellarIngredientIds: [], privacySettings: {}, ageVerified: true },
    toggleCellarIngredient: mockToggle,
  }),
}));
jest.mock('@/state/ContentState', () => ({
  useContent: () => ({ snapshot: { ingredients: [{ id: 'gin', name: '金酒', category: 'base' }] }, isRefreshing: false, lastRefreshError: null, refresh: jest.fn() }),
}));
jest.mock('@/components/mixology/ScreenShell', () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/mixology/TopBar', () => ({ TopBar: () => null }));
jest.mock('@/components/mixology/IngredientChip', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { IngredientChip: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable testID="ingredient-gin" onPress={onPress}><Text>{label}</Text></Pressable> };
});

describe('CellarIngredientsScreen', () => {
  beforeEach(() => {
    mockToggle.mockReset();
    mockToggle.mockResolvedValue(undefined);
  });

  it('shows a retryable error instead of leaking a rejected cellar write', async () => {
    mockToggle.mockRejectedValueOnce(new Error('offline'));
    const screen = await render(<CellarIngredientsScreen />);

    await fireEvent.press(screen.getByTestId('ingredient-gin'));

    await waitFor(() => expect(screen.getByText('同步失败，请重试')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ingredient-gin'));
    expect(mockToggle).toHaveBeenCalledTimes(2);
  });
});
