import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { RecipeCard } from '@/components/mixology/RecipeCard';
import type { CocktailRecipe } from '@/types/mixology';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const recipe: CocktailRecipe = {
  id: 'classic-margarita',
  name: '玛格丽特',
  englishName: 'Margarita',
  description: '龙舌兰、青柠和橙味利口酒带来清爽酸甜，是最适合作为第一杯练习的经典配方。',
  tags: ['经典', '酸甜', '派对'],
  ingredients: [],
  steps: [],
  imageKey: 'margarita',
  difficulty: '入门',
  prepMinutes: 6,
};

describe('RecipeCard', () => {
  it('renders recipe name, english name and meta pills', async () => {
    const screen = await render(<RecipeCard recipe={recipe} />);

    expect(screen.getByTestId('recipe-card')).toBeTruthy();
    expect(screen.getByText('玛格丽特')).toBeTruthy();
    expect(screen.getByText('Margarita')).toBeTruthy();
    expect(screen.getByText('6分钟')).toBeTruthy();
    expect(screen.getByText('入门')).toBeTruthy();
  });

  it('shows description in default mode and hides it in compact mode', async () => {
    const full = await render(<RecipeCard recipe={recipe} />);
    const compact = await render(<RecipeCard recipe={recipe} compact />);

    expect(full.getByText(recipe.description)).toBeTruthy();
    expect(compact.queryByText(recipe.description)).toBeNull();
  });

  it('uses flex:1 in compact mode so it fits multi-column grids', async () => {
    const screen = await render(<RecipeCard recipe={recipe} compact />);
    const card = screen.getByTestId('recipe-card');
    const style = StyleSheet.flatten(card.props.style);

    expect(style.flex).toBe(1);
  });

  it('lowers image height in compact mode for tighter grids', async () => {
    const screen = await render(<RecipeCard recipe={recipe} compact />);
    const image = screen.getByTestId('recipe-card-image');
    const style = StyleSheet.flatten(image.props.style);

    expect(style.height).toBeLessThan(150);
  });
});
