import { Alert, StyleSheet } from 'react-native';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AiHistoryDrawer } from '@/components/ai/AiHistoryDrawer';

const avatarSource = { uri: 'avatar' };
const now = new Date('2026-07-30T04:00:00Z');

describe('AiHistoryDrawer', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('groups conversations by Beijing recency and caps panel width', async () => {
    const screen = await render(
      <AiHistoryDrawer
        visible
        width={430}
        avatarSource={avatarSource}
        displayName="lan Bai"
        conversations={[
          { id: '1', title: '今天问题', lastMessageAt: '2026-07-30T03:00:00Z', createdAt: '2026-07-30T03:00:00Z' },
          { id: '2', title: '昨天问题', lastMessageAt: '2026-07-29T05:00:00Z', createdAt: '2026-07-29T05:00:00Z' },
          { id: '3', title: '过去问题', lastMessageAt: '2026-07-26T05:00:00Z', createdAt: '2026-07-26T05:00:00Z' },
          { id: '4', title: '更早问题', lastMessageAt: '2026-07-01T05:00:00Z', createdAt: '2026-07-01T05:00:00Z' },
        ]}
        selectedConversationId="1"
        now={now}
        onClose={jest.fn()}
        onNewChat={jest.fn()}
        onPick={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(StyleSheet.flatten(screen.getByTestId('ai-history-drawer').props.style).width).toBe(340);
    expect(screen.getByText('今天')).toBeTruthy();
    expect(screen.getByText('昨天')).toBeTruthy();
    expect(screen.getByText('过去 7 天')).toBeTruthy();
    expect(screen.getByText('更早')).toBeTruthy();
  });

  it('confirms deletion before calling delete', async () => {
    const onDelete = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    const screen = await render(
      <AiHistoryDrawer
        visible
        width={320}
        avatarSource={avatarSource}
        displayName="lan Bai"
        conversations={[{ id: '1', title: '今天问题', lastMessageAt: '2026-07-30T03:00:00Z', createdAt: '2026-07-30T03:00:00Z' }]}
        selectedConversationId={null}
        now={now}
        onClose={jest.fn()}
        onNewChat={jest.fn()}
        onPick={jest.fn()}
        onDelete={onDelete}
      />
    );

    await fireEvent.press(screen.getByTestId('ai-history-delete-1'));
    expect(alert).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('1');
  });
});
