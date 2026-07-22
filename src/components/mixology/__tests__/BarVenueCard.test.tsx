import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { BarVenueCard } from '@/components/mixology/BarVenueCard';
import type { BarVenue } from '@/types/mixology';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
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
  tags: ['安静'],
  tasteScore: 4.2,
  environmentScore: 4.4,
  serviceScore: 4.1,
  phone: '021-00000000',
  menu: [],
  reviews: [],
};

describe('BarVenueCard', () => {
  it('renders as a separated venue card with a visible distance label', async () => {
    const screen = await render(<BarVenueCard venue={venue} favorite={false} onToggleFavorite={jest.fn()} />);

    expect(screen.getByTestId('bar-venue-card')).toBeTruthy();
    expect(screen.getByText('步行150m')).toBeTruthy();
  });

  it('uses a compact cover image inside the separated venue card', async () => {
    const screen = await render(<BarVenueCard venue={venue} favorite={false} onToggleFavorite={jest.fn()} />);
    const cover = screen.getByTestId('bar-venue-cover');
    const style = StyleSheet.flatten(cover.props.style);

    expect(style.height).toBeLessThanOrEqual(104);
  });
});
