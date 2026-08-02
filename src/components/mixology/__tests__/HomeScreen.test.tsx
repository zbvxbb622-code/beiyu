import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen, { getDailyMenuRecipes } from '@/app/index';
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

describe('HomeScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses concrete dimensions for the first banner image so it renders in Expo native', async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    const images = screen.container.queryAll((node) => node.type === 'Image');
    const bannerImage = images[0];
    const style = StyleSheet.flatten(bannerImage.props.style);

    expect(typeof style.width).toBe('number');
    expect(typeof style.height).toBe('number');
    expect(style.width).toBeGreaterThan(0);
    expect(style.height).toBeGreaterThan(0);
  });

  it('renders shortcuts from the current content snapshot', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.shortcuts[0].title = '后台发布的盲盒';

    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider snapshot={snapshot}>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByText('后台发布的盲盒')).toBeTruthy();
  });

  it('does not show the shared cellar shortcut in the bundled home shortcuts', async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.queryByText('共享酒柜')).toBeNull();
  });

  it('filters the retired shared cellar shortcut even when stale backend content returns it', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.shortcuts.push({
      id: 'shared-cellar',
      title: '共享酒柜',
      description: '看看大家在喝什么',
      icon: 'cellar',
      route: '/cellar',
    });

    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider snapshot={snapshot}>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.queryByText('共享酒柜')).toBeNull();
  });

  it('does not restore bundled banners or shortcuts when remote content is empty', async () => {
    const snapshot = createContentTestSnapshot();
    snapshot.banners = [];
    snapshot.shortcuts = [];

    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider snapshot={snapshot}>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.queryByTestId('home-banner')).toBeNull();
    expect(screen.queryByText('经典盲盒')).toBeNull();
  });

  it('renames the latest menu section to the daily menu', async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByText('每日酒单')).toBeTruthy();
    expect(screen.queryByText('最新酒单')).toBeNull();
  });

  it('rotates the daily menu recipe set by date', async () => {
    const snapshot = createContentTestSnapshot();
    const firstLabels = getDailyMenuRecipes(snapshot.recipes, new Date('2026-07-29T10:00:00+08:00'))
      .map((recipe) => `${recipe.name} ${recipe.englishName}`);
    const secondLabels = getDailyMenuRecipes(snapshot.recipes, new Date('2026-07-30T10:00:00+08:00'))
      .map((recipe) => `${recipe.name} ${recipe.englishName}`);

    expect(firstLabels).toHaveLength(6);
    expect(secondLabels).toHaveLength(6);
    expect(firstLabels).not.toEqual(secondLabels);
  });

  it('renders six daily menu modules to fill the home viewport', async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.getAllByTestId('daily-menu-tile')).toHaveLength(6);
  });

  it('uses option five with a featured daily menu card and thumbnail strip', async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('daily-menu-featured-card')).toBeTruthy();
    expect(screen.getByTestId('daily-menu-thumbnail-strip')).toBeTruthy();
    expect(screen.getAllByTestId('daily-menu-thumbnail-tile')).toHaveLength(5);
  });

  it('switches the featured daily menu card from the thumbnail strip', async () => {
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <ContentTestProvider>
          <HomeScreen />
        </ContentTestProvider>
      </SafeAreaProvider>
    );
    const firstTitle = screen.getByTestId('daily-menu-featured-title').props.children;

    fireEvent.press(screen.getAllByTestId('daily-menu-thumbnail-tile')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('daily-menu-featured-title').props.children).not.toBe(firstTitle);
    });
  });
});
