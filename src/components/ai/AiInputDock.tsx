import { Send } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { AiUsageResponse } from '@/services/ai/aiSchemas';
import type { AiChatMode, AiViewStatus } from '@/state/AiState';
import { colors } from '@/styles/mixologyTheme';

export function AiInputDock({
  draft,
  status,
  mode,
  usage,
  onChangeDraft,
  onSend,
}: {
  draft: string;
  status: AiViewStatus;
  mode: AiChatMode;
  usage: AiUsageResponse | null;
  onChangeDraft: (value: string) => void;
  onSend: (content?: string) => void;
}) {
  const draftRef = useRef(draft);
  const sending = status === 'sending';
  const exhausted = status === 'quotaExhausted' || usage?.remaining === 0;
  const lowQuota = usage && usage.remaining > 0 && usage.remaining <= 10;
  const canUseInput = !sending && !exhausted;
  const canSend = canUseInput && draft.trim().length > 0;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const changeDraft = (value: string) => {
    draftRef.current = value;
    onChangeDraft(value);
  };

  const sendDraft = () => {
    const latestDraft = draftRef.current;
    if (canUseInput && latestDraft.trim()) onSend(latestDraft);
  };

  return (
    <View testID="ai-input-dock" style={styles.inputDock}>
      {mode === 'temporary' ? <Text style={styles.statusText}>临时对话不会保存到历史</Text> : null}
      {exhausted ? (
        <Text style={styles.statusText}>今日次数已用完</Text>
      ) : lowQuota ? (
        <Text style={styles.statusText}>今日还剩 {usage.remaining} 次</Text>
      ) : null}
      <View style={styles.inputPill}>
        <TextInput
          value={draft}
          onChangeText={changeDraft}
          placeholder="询问饮品配方或寻求推荐…"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={sendDraft}
          returnKeyType="send"
          style={styles.input}
          editable={canUseInput}
        />
        <Pressable
          testID="ai-send-button"
          onPress={sendDraft}
          style={({ pressed }) => [styles.voiceButton, pressed && canSend ? styles.pressed : null, !canSend ? styles.disabled : null]}
          accessibilityLabel="发送"
        >
          <View testID="ai-send-button-surface" style={styles.voiceSurface}>
            <Send color="#ffffff" size={21} strokeWidth={2.6} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  inputDock: {
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 10,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  inputPill: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.24)',
    backgroundColor: colors.inputDark,
    paddingLeft: 18,
    paddingRight: 7,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 9,
  },
  voiceButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceSurface: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pink,
  },
  disabled: {
    opacity: 0.45,
  },
});
