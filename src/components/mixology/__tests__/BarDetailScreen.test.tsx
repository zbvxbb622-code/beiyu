import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import BarDetailScreen from '@/app/bar/[id]';
import type { BarVenue } from '@/types/mixology';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-bar' }),
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

const venue: BarVenue = {
  id: 'test-bar',
  name: 'Test Bar',
  imageKey: 'barInterior',
  rating: 4.3,
  reviewCount: 20,
  averageSpend: 88,
  distanceLabel: '步行150m',
  metroHint: '距离地铁口步行150m',
  address: '测试路 1 号',
  openHours: '营业中 18:00-02:00',
  description: '安静、有招牌酒，适合第一轮约会。',
  tags: ['安静', '吧台'],
  tasteScore: 4.2,
  environmentScore: 4.4,
  serviceScore: 4.1,
  phone: '021-00000000',
  menu: [
    { id: 'm1', name: '招牌一号', imageKey: 'margarita', likes: 18 },
    { id: 'm2', name: '招牌二号', imageKey: 'negroni', likes: 12 },
  ],
  reviews: [],
};

jest.mock('@/services/contentService', () => ({
  getBarVenueById: () => venue,
}));

jest.mock('@/state/MixologyState', () => ({
  useMixology: () => ({
    interactionState: {
      favoriteVenueIds: [],
    },
    toggleVenueFavorite: jest.fn(),
  }),
}));

describe('BarDetailScreen', () => {
  it('uses one design-size hero image at the top', async () => {
    const screen = await render(<BarDetailScreen />);
    const hero = screen.getByTestId('bar-detail-hero');
    const style = StyleSheet.flatten(hero.props.style);

    expect(style.height).toBeLessThanOrEqual(240);
  });
});
