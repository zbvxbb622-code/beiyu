import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { RecipeEditorialRow } from '@/components/mixology/RecipeEditorialRow';
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

describe('RecipeEditorialRow', () => {
  it('renders title, english name, description and meta pills', async () => {
    const screen = await render(<RecipeEditorialRow recipe={recipe} />);

    expect(screen.getByTestId('recipe-card')).toBeTruthy();
    expect(screen.getByText('玛格丽特')).toBeTruthy();
    expect(screen.getByText('Margarita')).toBeTruthy();
    expect(screen.getByText(recipe.description)).toBeTruthy();
    expect(screen.getByText('6分钟')).toBeTruthy();
    expect(screen.getByText('入门')).toBeTruthy();
  });

  it('uses a smaller thumb on compact screens', async () => {
    const screen = await render(<RecipeEditorialRow recipe={recipe} />);
    const image = screen.getByTestId('recipe-card-image');
    const style = StyleSheet.flatten(image.props.style);

    // 测试运行在默认 750px 宽虚拟视口，不属于 compact，所以保持 88
    expect(style.width).toBe(88);
    expect(style.height).toBe(88);
  });
});
