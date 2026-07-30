import { useRouter } from 'expo-router';
import { BrainCircuit, ChevronLeft, Trash2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { Toggle } from '@/components/mixology/Toggle';
import type { AiMemoryCategory, AiMemoryResponse } from '@/services/ai/aiSchemas';
import { useAi } from '@/state/AiState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

const categoryLabels: Record<AiMemoryCategory, string> = {
  DRINK_PREFERENCE: '饮品偏好',
  EMOTIONAL_PREFERENCE: '互动偏好',
  SAFETY_REMINDER: '安全提醒',
};

function formatMemoryDate(value: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

export default function AiMemorySettingsScreen() {
  const router = useRouter();
  const ai = useAi();
  const loadMemories = ai.loadMemories;

  useEffect(() => {
    if (ai.isReady) {
      void loadMemories();
    }
  }, [ai.isReady, loadMemories]);

  const toggleMemory = () => {
    void ai.setMemoryEnabled(!ai.memoryEnabled);
  };

  const confirmDelete = (memory: AiMemoryResponse) => {
    Alert.alert('删除记忆', `删除「${memory.summary}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void ai.deleteMemory(memory.id) },
    ]);
  };

  const confirmClear = () => {
    Alert.alert('清空 AI 记忆', '清空后，AI 将不会再参考这些记忆。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => void ai.clearMemories() },
    ]);
  };

  return (
    <ScreenShell padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="ai-memory-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>AI 记忆</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          <View style={styles.group}>
            <Pressable
              testID="ai-memory-enabled-toggle"
              onPress={toggleMemory}
              style={({ pressed }) => [styles.toggleRow, pressed ? styles.pressed : null]}
            >
              <View style={styles.itemIcon}>
                <BrainCircuit color={colors.text} size={21} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>透明记忆</Text>
                <Text style={styles.itemSubtitle}>
                  {ai.memoryEnabled ? 'AI 可参考这些记忆提供更贴近你的建议' : '记忆已关闭'}
                </Text>
              </View>
              <Toggle value={ai.memoryEnabled} onColor={colors.pink} />
            </Pressable>
          </View>

          {ai.error ? <Text style={styles.errorText}>{ai.error}</Text> : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>已保存</Text>
            {ai.memories.length > 0 ? (
              <Pressable
                testID="ai-memory-clear-all"
                onPress={confirmClear}
                style={({ pressed }) => [styles.clearButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.clearText}>清空全部</Text>
              </Pressable>
            ) : null}
          </View>

          {ai.memories.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>暂无可展示的 AI 记忆</Text>
            </View>
          ) : (
            <View style={styles.memoryList}>
              {ai.memories.map((memory) => (
                <View key={memory.id} style={styles.memoryItem}>
                  <View style={styles.memoryCopy}>
                    <View style={styles.memoryMetaRow}>
                      <Text style={styles.categoryLabel}>{categoryLabels[memory.category]}</Text>
                      <Text style={styles.dateText}>{formatMemoryDate(memory.createdAt)}</Text>
                    </View>
                    <Text style={[styles.summaryText, !ai.memoryEnabled ? styles.summaryDisabled : null]}>
                      {memory.summary}
                    </Text>
                  </View>
                  <Pressable
                    testID={`ai-memory-delete-${memory.id}`}
                    onPress={() => confirmDelete(memory)}
                    style={({ pressed }) => [styles.deleteButton, pressed ? styles.pressed : null]}
                    accessibilityLabel="删除记忆"
                  >
                    <Trash2 color={colors.textMuted} size={18} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.bottomNavPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerSidePressable: {
    width: 44,
    height: 44,
  },
  headerSideInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSidePlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
  },
  group: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    marginBottom: 14,
    overflow: 'hidden',
  },
  toggleRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  itemIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  itemSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  errorText: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  clearButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  clearText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBlock: {
    minHeight: 118,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  memoryList: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    overflow: 'hidden',
  },
  memoryItem: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  memoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  memoryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryLabel: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '800',
    marginRight: 8,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  summaryText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  summaryDisabled: {
    color: colors.textMuted,
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pressed: {
    opacity: 0.72,
  },
});
