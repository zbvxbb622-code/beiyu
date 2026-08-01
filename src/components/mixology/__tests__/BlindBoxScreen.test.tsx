import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import BlindBoxScreen from '@/app/blind-box';
import { blindBoxCards } from '@/data/blindBoxCards';

const mockRouterPush = jest.fn();
const mockDrawBlindBoxCard = jest.fn();
const drawnCard = blindBoxCards[0];
let mockLastDrawDate: string | null | undefined;
let mockDrawnCards: unknown[] = [];

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
        lastDrawDate: mockLastDrawDate === undefined ? getTodayKey() : mockLastDrawDate,
        drawnCards: mockDrawnCards.length > 0 ? mockDrawnCards : [{ card: cards[0], drawnAt: new Date().toISOString() }],
      },
      drawBlindBoxCard: mockDrawBlindBoxCard,
    }),
  };
});

describe('BlindBoxScreen', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    mockDrawBlindBoxCard.mockClear();
    const { todayKey: getTodayKey } = jest.requireActual('@/services/blindBoxService') as {
      todayKey: () => string;
    };
    mockLastDrawDate = getTodayKey();
    mockDrawnCards = [{ card: drawnCard, drawnAt: new Date().toISOString() }];
  });

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

  it('shows the draw video in a landscape frame instead of a square card box', async () => {
    const screen = await render(<BlindBoxScreen />);

    fireEvent.press(screen.getByTestId('test-draw-button'));
    await waitFor(() => {
      expect(screen.getByText('轻触跳过')).toBeTruthy();
    });

    const videoFrame = StyleSheet.flatten(screen.getByTestId('blind-box-video-wrap').props.style);
    expect(videoFrame.width).toBeGreaterThan(videoFrame.height);
    expect(videoFrame.height / videoFrame.width).toBeLessThanOrEqual(0.6);
  });

  it('keeps a visible draw animation fallback until native video paints a frame', async () => {
    const screen = await render(<BlindBoxScreen />);

    fireEvent.press(screen.getByTestId('test-draw-button'));
    await waitFor(() => {
      expect(screen.getByText('轻触跳过')).toBeTruthy();
    });

    expect(screen.getByTestId('blind-box-fallback-animation')).toBeTruthy();
    expect(screen.getAllByTestId(/blind-box-fallback-card-/).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the revealed card inside its stage so action buttons sit below it', async () => {
    const screen = await render(<BlindBoxScreen />);

    fireEvent.press(screen.getByTestId('test-draw-button'));
    await waitFor(() => {
      expect(screen.getByText('轻触跳过')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('blind-box-video-wrap'));

    await waitFor(() => {
      expect(screen.getByTestId('blind-box-card-frame')).toBeTruthy();
    });

    const stage = StyleSheet.flatten(screen.getByTestId('blind-box-stage').props.style);
    const cardFrame = StyleSheet.flatten(screen.getByTestId('blind-box-card-frame').props.style);

    expect(cardFrame.height).toBeLessThanOrEqual(stage.height);
    expect(cardFrame.height).toBeLessThanOrEqual(430);
  });

  it('centers the revealed card and actions in the available phone height', async () => {
    const screen = await render(<BlindBoxScreen />);

    fireEvent.press(screen.getByTestId('test-draw-button'));
    await waitFor(() => {
      expect(screen.getByText('轻触跳过')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('blind-box-video-wrap'));

    await waitFor(() => {
      expect(screen.getByTestId('blind-box-card-frame')).toBeTruthy();
    });

    const mainContent = StyleSheet.flatten(screen.getByTestId('blind-box-main-content').props.style);
    expect(mainContent.flex).toBe(1);
    expect(mainContent.justifyContent).toBe('center');
  });

  it('keeps the unopened card compact so the draw button is reachable on phone screens', async () => {
    mockLastDrawDate = null;
    mockDrawnCards = [];

    const screen = await render(<BlindBoxScreen />);
    const cardBack = StyleSheet.flatten(screen.getByTestId('blind-box-card-back-wrap').props.style);

    expect(screen.getByTestId('draw-button')).toBeTruthy();
    expect(cardBack.height).toBeLessThanOrEqual(360);
  });
});
