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

  it('groups conversations by Beijing recency and keeps the panel compact on phone screens', async () => {
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

    expect(StyleSheet.flatten(screen.getByTestId('ai-history-drawer').props.style).width).toBeLessThanOrEqual(320);
    expect(screen.getByText('今天')).toBeTruthy();
    expect(screen.getByText('昨天')).toBeTruthy();
    expect(screen.getByText('过去 7 天')).toBeTruthy();
    expect(screen.getByText('更早')).toBeTruthy();
  });

  it('closes from an explicit drawer button', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <AiHistoryDrawer
        visible
        width={390}
        avatarSource={avatarSource}
        displayName="lan Bai"
        conversations={[]}
        selectedConversationId={null}
        now={now}
        onClose={onClose}
        onNewChat={jest.fn()}
        onPick={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    await fireEvent.press(screen.getByTestId('ai-history-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('keeps the delete button reachable when a conversation title is long', async () => {
    const screen = await render(
      <AiHistoryDrawer
        visible
        width={390}
        avatarSource={avatarSource}
        displayName="lan Bai"
        conversations={[
          {
            id: 'long',
            title: '测试 AI 聊天发送 ui-send-1785567444177 以及一段很长很长的历史标题',
            lastMessageAt: '2026-07-30T03:00:00Z',
            createdAt: '2026-07-30T03:00:00Z',
          },
        ]}
        selectedConversationId={null}
        now={now}
        onClose={jest.fn()}
        onNewChat={jest.fn()}
        onPick={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const titlePressable = StyleSheet.flatten(screen.getByTestId('ai-history-title-long').props.style);
    const row = StyleSheet.flatten(screen.getByTestId('ai-history-row-long').props.style);
    const deleteButton = StyleSheet.flatten(screen.getByTestId('ai-history-delete-long').props.style);

    expect(row.width).toBe('100%');
    expect(titlePressable.minWidth).toBe(0);
    expect(titlePressable.flexShrink).toBe(1);
    expect(deleteButton.flexShrink).toBe(0);
    expect(deleteButton.width).toBeGreaterThanOrEqual(36);
  });

  it('keeps the drawer, header, and list content inside a narrow phone viewport', async () => {
    const screen = await render(
      <AiHistoryDrawer
        visible
        width={320}
        avatarSource={avatarSource}
        displayName="游客调酒师名字特别特别长"
        conversations={[
          {
            id: 'narrow',
            title: '测试 AI 聊天发送 ui-send-1785567444177 以及一段很长很长的历史标题',
            lastMessageAt: '2026-07-30T03:00:00Z',
            createdAt: '2026-07-30T03:00:00Z',
          },
        ]}
        selectedConversationId={null}
        now={now}
        onClose={jest.fn()}
        onNewChat={jest.fn()}
        onPick={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const drawer = StyleSheet.flatten(screen.getByTestId('ai-history-drawer').props.style);
    const safe = StyleSheet.flatten(screen.getByTestId('ai-history-safe-area').props.style);
    const search = StyleSheet.flatten(screen.getByTestId('ai-history-search-box').props.style);

    expect(drawer.width).toBeLessThanOrEqual(248);
    expect(safe.paddingTop).toBeGreaterThanOrEqual(44);
    expect(search.width).toBe('100%');
    expect(screen.getByTestId('ai-history-delete-narrow')).toBeTruthy();
  });
});
