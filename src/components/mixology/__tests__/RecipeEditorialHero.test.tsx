import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { RecipeEditorialHero } from '@/components/mixology/RecipeEditorialHero';
import type { CocktailRecipe } from '@/types/mixology';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const recipe: CocktailRecipe = {
  id: 'classic-margarita',
  name: '玛格丽特',
  englishName: 'Margarita',
  description: '龙舌兰、青柠和橙味利口酒带来清爽酸甜，是最适合作为第一杯练习的经典配方。',
  tags: ['经典'],
  ingredients: [],
  steps: [],
  imageKey: 'margarita',
  difficulty: '入门',
  prepMinutes: 6,
};

describe('RecipeEditorialHero', () => {
  it('renders the featured tag, title, description and meta', async () => {
    const screen = await render(<RecipeEditorialHero recipe={recipe} />);

    expect(screen.getByTestId('recipe-hero')).toBeTruthy();
    expect(screen.getByText('每日推荐')).toBeTruthy();
    expect(screen.getByText('玛格丽特')).toBeTruthy();
    expect(screen.getByText('Margarita')).toBeTruthy();
    expect(screen.getByText(recipe.description)).toBeTruthy();
    expect(screen.getByText('查看配方')).toBeTruthy();
    expect(screen.getByText('6分钟')).toBeTruthy();
    expect(screen.getByText('入门')).toBeTruthy();
  });

  it('keeps the hero image at full width on non-compact screens', async () => {
    const screen = await render(<RecipeEditorialHero recipe={recipe} />);
    const image = screen.getByTestId('recipe-hero-image');
    const style = StyleSheet.flatten(image.props.style);

    expect(style.height).toBe(208);
  });
});
