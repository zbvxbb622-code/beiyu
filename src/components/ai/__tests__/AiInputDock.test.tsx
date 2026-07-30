import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { AiInputDock } from '@/components/ai/AiInputDock';

describe('AiInputDock', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows low quota and sends controlled input', async () => {
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
        onOpenTools={jest.fn()}
      />
    );

    expect(screen.getByText('今日还剩 10 次')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('询问饮品配方或寻求推荐…'), '玛格丽特');
    await fireEvent.press(screen.getByTestId('ai-send-button'));
    expect(onChangeDraft).toHaveBeenCalledWith('玛格丽特');
    expect(onSend).toHaveBeenCalledTimes(1);
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
        onOpenTools={jest.fn()}
      />
    );
    await fireEvent.press(sending.getByTestId('ai-send-button'));
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
        onOpenTools={jest.fn()}
      />
    );
    expect(exhausted.getByText('今日次数已用完')).toBeTruthy();
    await fireEvent.press(exhausted.getByTestId('ai-send-button'));
    expect(onSend).not.toHaveBeenCalled();
  });
});
