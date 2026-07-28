import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import BlindBoxScreen from '@/app/blind-box';
import { blindBoxCards } from '@/data/blindBoxCards';

const mockRouterPush = jest.fn();
const mockDrawBlindBoxCard = jest.fn();
const drawnCard = blindBoxCards[0];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    addListener: () => ({ remove: jest.fn() }),
    replay: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    playing: false,
    currentTime: 0,
  }),
  VideoView: () => null,
}));

jest.mock('@/state/MixologyState', () => {
  // 工厂内不允许引用外层 import，需用 require 惰性加载
  const { todayKey: getTodayKey } = jest.requireActual('@/services/blindBoxService') as {
    todayKey: () => string;
  };
  const { blindBoxCards: cards } = jest.requireActual('@/data/blindBoxCards') as {
    blindBoxCards: unknown[];
  };
  return {
    useMixology: () => ({
      isHydrated: true,
      interactionState: {
        lastDrawDate: getTodayKey(),
        drawnCards: [{ card: cards[0], drawnAt: new Date().toISOString() }],
      },
      drawBlindBoxCard: mockDrawBlindBoxCard,
    }),
  };
});

describe('BlindBoxScreen', () => {
  it('点分享跳转发布页并预填卡牌内容（不直接发帖）', async () => {
    const screen = await render(<BlindBoxScreen />);

    fireEvent.press(screen.getByTestId('share-button'));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/publish-post',
        params: expect.objectContaining({
          from: 'blind-box',
          imageKey: drawnCard.imageKey,
          title: expect.stringContaining(drawnCard.name),
          body: expect.stringContaining(drawnCard.name),
        }),
      })
    );
  });

  it('测试按钮可重复抽卡且不消耗每日次数', async () => {
    const screen = await render(<BlindBoxScreen />);

    // 已抽卡状态下仍可点测试按钮 → 进入视频过场阶段
    fireEvent.press(screen.getByTestId('test-draw-button'));
    await waitFor(() => {
      expect(screen.getByText('轻触跳过')).toBeTruthy();
    });
    // 未调用受限的每日抽卡接口
    expect(mockDrawBlindBoxCard).not.toHaveBeenCalled();
  });
});
