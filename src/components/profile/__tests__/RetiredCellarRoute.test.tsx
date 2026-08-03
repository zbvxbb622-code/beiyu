import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import CellarScreen from '@/app/cellar';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: { likedCellarCardIds: [] },
    toggleCellarCardLike: jest.fn(),
  }),
}));

describe('Retired cellar route', () => {
  it('redirects retired cellar routes back to profile', async () => {
    const screen = await render(<CellarScreen />);

    expect(screen.getByText('redirect:/profile')).toBeTruthy();
    expect(screen.queryByText('大家的酒柜')).toBeNull();
  });
});
