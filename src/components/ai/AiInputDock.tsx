import { LinearGradient } from 'expo-linear-gradient';
import { AudioLines, Mic, Plus, Send } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { AiUsageResponse } from '@/services/ai/aiSchemas';
import type { AiChatMode, AiViewStatus } from '@/state/AiState';
import { colors, gradients } from '@/styles/mixologyTheme';

export function AiInputDock({
  draft,
  status,
  mode,
  usage,
  onChangeDraft,
  onSend,
  onOpenTools,
}: {
  draft: string;
  status: AiViewStatus;
  mode: AiChatMode;
  usage: AiUsageResponse | null;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onOpenTools: () => void;
}) {
  const sending = status === 'sending';
  const exhausted = status === 'quotaExhausted' || usage?.remaining === 0;
  const lowQuota = usage && usage.remaining > 0 && usage.remaining <= 10;
  const canSend = !sending && !exhausted;

  return (
    <View testID="ai-input-dock" style={styles.inputDock}>
      {mode === 'temporary' ? <Text style={styles.statusText}>临时对话不会保存到历史</Text> : null}
      {exhausted ? (
        <Text style={styles.statusText}>今日次数已用完</Text>
      ) : lowQuota ? (
        <Text style={styles.statusText}>今日还剩 {usage.remaining} 次</Text>
      ) : null}
      <View style={styles.inputPill}>
        <Pressable onPress={onOpenTools} style={styles.plusButton} accessibilityLabel="更多">
          <Plus color="#ffffff" size={29} strokeWidth={2.2} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="询问饮品配方或寻求推荐…"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => {
            if (canSend) onSend();
          }}
          returnKeyType="send"
          style={styles.input}
          editable={!sending && !exhausted}
        />
        <Mic color="#b7b3be" size={25} strokeWidth={2.3} />
        <Pressable
          testID="ai-send-button"
          onPress={() => {
            if (canSend) onSend();
          }}
          style={({ pressed }) => [styles.voiceButton, pressed && canSend ? styles.pressed : null, !canSend ? styles.disabled : null]}
          accessibilityLabel="发送"
        >
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.voiceGradient}>
            {draft.trim() ? (
              <Send color="#ffffff" size={21} strokeWidth={2.6} />
            ) : (
              <AudioLines color="#ffffff" size={25} strokeWidth={2.4} />
            )}
          </LinearGradient>
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
    paddingLeft: 7,
    paddingRight: 7,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    overflow: 'hidden',
  },
  voiceGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
