import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import AiScreen from '@/app/ai';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    localState: {
      cellarIngredientIds: [],
    },
  }),
}));

describe('AiScreen', () => {
  it('shows starter prompt chips so the chat page is not visually empty', async () => {
    const screen = await render(<AiScreen />);

    expect(screen.getByText('今晚想喝什么？')).toBeTruthy();
    expect(screen.getByText('清爽低负担')).toBeTruthy();
  });
});
