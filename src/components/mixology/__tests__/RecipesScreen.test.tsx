import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import RecipesScreen from '@/app/recipes';
import {
  ContentTestProvider,
  createContentTestSnapshot,
} from '@/test-utils/ContentTestProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('RecipesScreen', () => {
  function renderScreen() {
    return render(
      <ContentTestProvider>
        <RecipesScreen />
      </ContentTestProvider>
    );
  }

  it('renders the header and recipe cards', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('经典系列')).toBeTruthy();
    expect(screen.getAllByTestId('recipe-card').length).toBeGreaterThan(1);
  });

  it('filters recipes by search query', async () => {
    const screen = await renderScreen();
    const input = screen.getByPlaceholderText('搜索酒款、风味...');

    await fireEvent.changeText(input, '玛格丽特');

    expect(screen.getAllByTestId('recipe-card').length).toBe(1);
    expect(screen.getByText('玛格丽特')).toBeTruthy();
  });

  it('shows an empty state when nothing matches', async () => {
    const screen = await renderScreen();
    const input = screen.getByPlaceholderText('搜索酒款、风味...');

    await fireEvent.changeText(input, 'not-a-recipe');

    expect(screen.getByTestId('recipes-empty')).toBeTruthy();
    expect(screen.queryByTestId('recipe-card')).toBeNull();
  });

  it('shows a daily hero when not searching and hides it while searching', async () => {
    const screen = await renderScreen();

    expect(screen.queryByTestId('recipe-hero')).toBeTruthy();

    const input = screen.getByPlaceholderText('搜索酒款、风味...');
    await fireEvent.changeText(input, '玛格丽特');

    expect(screen.queryByTestId('recipe-hero')).toBeNull();
  });

  it('renders a recipe name from the current content snapshot', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.recipes[0].name = '后台发布的玛格丽特';

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <RecipesScreen />
      </ContentTestProvider>
    );

    expect(screen.getAllByText('后台发布的玛格丽特').length).toBeGreaterThan(0);
  });
});
