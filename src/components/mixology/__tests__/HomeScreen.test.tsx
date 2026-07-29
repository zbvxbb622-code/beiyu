import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/index';
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
});
