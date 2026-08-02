import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import BarDetailScreen from '@/app/bar/[id]';
import BarsScreen from '@/app/bars';
import CellarIngredientsScreen from '@/app/cellar-ingredients';
import DrinkKnowledgeScreen from '@/app/drink-knowledge';
import RecipeDetailScreen from '@/app/recipe/[id]';
import SearchScreen from '@/app/search';
import {
  ContentTestProvider,
  createContentTestSnapshot,
} from '@/test-utils/ContentTestProvider';

let mockRouteId = 'remote-recipe';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockRouteId }),
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: {
      favoriteVenueIds: [],
      localCommunityPosts: [],
      searchHistory: [],
    },
    localState: {
      cellarIngredientIds: [],
    },
    toggleCellarIngredient: jest.fn(),
    toggleVenueFavorite: jest.fn(),
    addSearchHistory: jest.fn(),
    clearSearchHistory: jest.fn(),
  }),
}));

describe('content-driven screens', () => {
  it('renders remote recipe detail data', async () => {
    const snapshot = createContentTestSnapshot();
    const recipe = { ...snapshot.recipes[0], id: 'remote-recipe', name: '后台酒谱详情' };
    snapshot.recipes = [recipe];
    mockRouteId = recipe.id;

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <RecipeDetailScreen />
      </ContentTestProvider>
    );

    expect(screen.getByText('后台酒谱详情')).toBeTruthy();
  });

  it('renders remote bars in list and detail views', async () => {
    const snapshot = createContentTestSnapshot();
    const bar = { ...snapshot.bars[0], id: 'remote-bar', name: '后台新酒吧' };
    snapshot.bars = [bar];
    mockRouteId = bar.id;

    const list = await render(
      <ContentTestProvider snapshot={snapshot}>
        <BarsScreen />
      </ContentTestProvider>
    );
    expect(list.getByText('后台新酒吧')).toBeTruthy();
    await list.unmount();

    const detail = await render(
      <ContentTestProvider snapshot={snapshot}>
        <BarDetailScreen />
      </ContentTestProvider>
    );
    expect(detail.getByText('后台新酒吧')).toBeTruthy();
  });

  it('marks nearby bars as unavailable until location service is connected', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.bars = [
      { ...snapshot.bars[0], id: 'remote-bar', name: '后台新酒吧' },
    ];

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <BarsScreen />
      </ContentTestProvider>
    );

    await fireEvent.press(screen.getByText('附近'));

    expect(screen.getByText('附近酒吧暂未开放')).toBeTruthy();
    expect(screen.queryByText('后台新酒吧')).toBeNull();
  });

  it('renders remote drink knowledge', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.knowledge = [
      { ...snapshot.knowledge[0], id: 'remote-knowledge', name: '后台酒品知识' },
    ];

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <DrinkKnowledgeScreen />
      </ContentTestProvider>
    );

    expect(screen.getByText('后台酒品知识')).toBeTruthy();
  });

  it('renders drink knowledge cards with a concrete cover image', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.knowledge = [
      { ...snapshot.knowledge[0], id: 'remote-knowledge', name: '后台酒品知识', imageKey: 'margarita', imageUrl: null },
    ];

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <DrinkKnowledgeScreen />
      </ContentTestProvider>
    );

    expect(screen.getByTestId('knowledge-cover-image')).toBeTruthy();
  });

  it('renders remote ingredients in the cellar selector', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.ingredients = [
      { id: 'remote-ingredient', name: '后台新配料', category: 'mixer' },
    ];

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <CellarIngredientsScreen />
      </ContentTestProvider>
    );

    expect(screen.getByText('后台新配料')).toBeTruthy();
  });

  it('searches remote recipes and bars alongside local posts', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.recipes = [
      { ...snapshot.recipes[0], id: 'remote-search-recipe', name: '星河特调' },
    ];
    snapshot.bars = [
      { ...snapshot.bars[0], id: 'remote-search-bar', name: '星河酒吧' },
    ];

    const screen = await render(
      <ContentTestProvider snapshot={snapshot}>
        <SearchScreen />
      </ContentTestProvider>
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText('搜酒谱、酒吧、帖子...'),
      '星河'
    );

    expect(screen.getByText('星河特调')).toBeTruthy();
    expect(screen.getByText('星河酒吧')).toBeTruthy();
  });
});
