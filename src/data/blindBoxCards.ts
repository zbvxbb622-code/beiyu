import type { BlindBoxCard, CardRarity } from '@/types/mixology';

import { cocktailRecipes } from './recipes';

// 稀有度配置：权重（越大越常见）+ 视觉主题
export const rarityConfig: Record<
  CardRarity,
  {
    weight: number;
    label: string;
    borderColor: string;
    glowColor: string;
    gradient: readonly [string, string, string];
  }
> = {
  common: {
    weight: 70,
    label: '普通',
    borderColor: '#e8e8e8',
    glowColor: 'rgba(232,232,232,0.5)',
    gradient: ['#2a2a2a', '#151112', '#1c1c1c'],
  },
  rare: {
    weight: 25,
    label: '稀有',
    borderColor: '#4da6ff',
    glowColor: 'rgba(77,166,255,0.6)',
    gradient: ['#0b2a4a', '#0a1428', '#123a5e'],
  },
  legendary: {
    weight: 5,
    label: '传说',
    borderColor: '#ffd24d',
    glowColor: 'rgba(255,210,77,0.7)',
    gradient: ['#3d2800', '#1a1206', '#4a3500'],
  },
};

// 每张酒谱对应一张卡牌，并指派稀有度
const cardRarityMap: Record<string, CardRarity> = {
  'classic-margarita': 'common',
  'gin-tonic': 'common',
  mojito: 'rare',
  negroni: 'legendary',
  'moscow-mule': 'rare',
};

// 调酒师署名（展示用）
const bartenderMap: Record<string, string> = {
  'classic-margarita': '调酒师高鹏',
  'gin-tonic': '调酒师高鹏',
  mojito: '调酒师阿May',
  negroni: '调酒师Leo',
  'moscow-mule': '调酒师高鹏',
};

export const blindBoxCards: BlindBoxCard[] = cocktailRecipes.map((recipe) => ({
  id: `card-${recipe.id}`,
  recipeId: recipe.id,
  rarity: cardRarityMap[recipe.id] ?? 'common',
  name: recipe.name,
  englishName: recipe.englishName,
  bartender: bartenderMap[recipe.id] ?? '调酒师',
  imageKey: recipe.imageKey,
  ingredients: recipe.ingredients,
  steps: recipe.steps,
}));

export function getCardById(cardId: string) {
  return blindBoxCards.find((card) => card.id === cardId);
}
