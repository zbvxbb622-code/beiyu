import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { AiInputDock } from '@/components/ai/AiInputDock';

function treeHasPropValue(node: unknown, propName: string, value: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => treeHasPropValue(child, propName, value));
  }
  if (!node || typeof node !== 'object') return false;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown };
  return candidate.props?.[propName] === value || treeHasPropValue(candidate.children, propName, value);
}

describe('AiInputDock', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render the unused tools plus button in the input bar', async () => {
    const screen = await render(
      <AiInputDock
        draft=""
        status="idle"
        mode="normal"
        usage={{ limit: 50, used: 1, remaining: 49, resetsAt: '2026-07-29T16:00:00Z' }}
        onChangeDraft={jest.fn()}
        onSend={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('更多')).toBeNull();
  });

  it('does not render the unused voice input button in the input bar', async () => {
    const screen = await render(
      <AiInputDock
        draft=""
        status="idle"
        mode="normal"
        usage={{ limit: 50, used: 1, remaining: 49, resetsAt: '2026-07-29T16:00:00Z' }}
        onChangeDraft={jest.fn()}
        onSend={jest.fn()}
      />
    );

    expect(treeHasPropValue(screen.toJSON(), 'color', '#b7b3be')).toBe(false);
  });

  it('shows low quota, keeps send control circular, and sends the latest input', async () => {
    const onChangeDraft = jest.fn();
    const onSend = jest.fn();
    const screen = await render(
      <AiInputDock
        draft="金汤力"
        status="idle"
        mode="normal"
        usage={{ limit: 50, used: 40, remaining: 10, resetsAt: '2026-07-29T16:00:00Z' }}
        onChangeDraft={onChangeDraft}
        onSend={onSend}
      />
    );

    expect(screen.getByText('今日还剩 10 次')).toBeTruthy();
    const sendSurface = StyleSheet.flatten(screen.getByTestId('ai-send-button-surface').props.style);
    expect(sendSurface.width).toBe(42);
    expect(sendSurface.height).toBe(42);
    expect(sendSurface.borderRadius).toBe(21);

    await fireEvent.changeText(screen.getByPlaceholderText('询问饮品配方或寻求推荐…'), '玛格丽特');
    await fireEvent.press(screen.getByTestId('ai-send-button'));
    expect(onChangeDraft).toHaveBeenCalledWith('玛格丽特');
    expect(onSend).toHaveBeenCalledWith('玛格丽特');
  });

  it('disables sending while sending', async () => {
    const onSend = jest.fn();
    const sending = await render(
      <AiInputDock
        draft="金汤力"
        status="sending"
        mode="normal"
        usage={{ limit: 50, used: 1, remaining: 49, resetsAt: '2026-07-29T16:00:00Z' }}
        onChangeDraft={jest.fn()}
        onSend={onSend}
      />
    );
    await fireEvent.press(sending.getByTestId('ai-send-button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send when the input is empty', async () => {
    const onSend = jest.fn();
    const screen = await render(
      <AiInputDock
        draft=""
        status="idle"
        mode="normal"
        usage={{ limit: 50, used: 1, remaining: 49, resetsAt: '2026-07-29T16:00:00Z' }}
        onChangeDraft={jest.fn()}
        onSend={onSend}
      />
    );

    await fireEvent.press(screen.getByTestId('ai-send-button'));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows exhausted quota and disables sending', async () => {
    const onSend = jest.fn();
    const exhausted = await render(
      <AiInputDock
        draft="金汤力"
        status="quotaExhausted"
        mode="normal"
        usage={{ limit: 50, used: 50, remaining: 0, resetsAt: '2026-07-29T16:00:00Z' }}
        onChangeDraft={jest.fn()}
        onSend={onSend}
      />
    );
    expect(exhausted.getByText('今日次数已用完')).toBeTruthy();
    await fireEvent.press(exhausted.getByTestId('ai-send-button'));
    expect(onSend).not.toHaveBeenCalled();
  });
});
