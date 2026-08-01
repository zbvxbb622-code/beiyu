import { useContext } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Search, Trash2, X } from 'lucide-react-native';

import type { ConversationResponse } from '@/services/ai/aiSchemas';
import { colors } from '@/styles/mixologyTheme';

type HistoryGroup = {
  title: string;
  items: ConversationResponse[];
};

export function groupConversationsByBeijingDay(
  conversations: ConversationResponse[],
  now = new Date()
): HistoryGroup[] {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dayKey = (date: Date) => formatter.format(date);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const groups: HistoryGroup[] = [
    { title: '今天', items: [] },
    { title: '昨天', items: [] },
    { title: '过去 7 天', items: [] },
    { title: '更早', items: [] },
  ];

  conversations.forEach((conversation) => {
    const date = new Date(conversation.lastMessageAt ?? conversation.createdAt);
    const key = dayKey(date);
    if (key === today) {
      groups[0].items.push(conversation);
    } else if (key === yesterday) {
      groups[1].items.push(conversation);
    } else if (date.getTime() >= sevenDaysAgo) {
      groups[2].items.push(conversation);
    } else {
      groups[3].items.push(conversation);
    }
  });

  return groups.filter((group) => group.items.length > 0);
}

export function AiHistoryDrawer({
  visible,
  width,
  avatarSource,
  displayName,
  conversations,
  selectedConversationId,
  now,
  onClose,
  onNewChat,
  onPick,
  onDelete,
}: {
  visible: boolean;
  width: number;
  avatarSource: ImageSourcePropType;
  displayName: string;
  conversations: ConversationResponse[];
  selectedConversationId: string | null;
  now?: Date;
  onClose: () => void;
  onNewChat: () => void;
  onPick: (conversation: ConversationResponse) => void;
  onDelete: (conversationId: string) => void;
}) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const panelWidth = Math.min(320, Math.max(236, width * 0.76), Math.max(236, width - 72));
  const groups = groupConversationsByBeijingDay(conversations, now);
  const drawerSafeStyle = [
    styles.drawerSafe,
    { paddingTop: Math.max(insets.top, 44) },
  ];

  const confirmDelete = (conversation: ConversationResponse) => {
    Alert.alert('删除对话', `删除「${conversation.title}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(conversation.id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerScene}>
        <View testID="ai-history-drawer" style={[styles.drawerPanel, { width: panelWidth }]}>
          <SafeAreaView testID="ai-history-safe-area" style={drawerSafeStyle} edges={['bottom']}>
            <View style={styles.drawerProfileRow}>
              <Image source={avatarSource} style={styles.drawerAvatar} />
              <Text style={styles.drawerName} numberOfLines={1}>{displayName}</Text>
              <Pressable onPress={onNewChat} style={styles.drawerNewChatButton} accessibilityLabel="新对话">
                <Plus color={colors.text} size={20} strokeWidth={2.6} />
              </Pressable>
              <Pressable
                testID="ai-history-close-button"
                onPress={onClose}
                style={({ pressed }) => [styles.drawerCloseButton, pressed ? styles.pressed : null]}
                accessibilityLabel="关闭历史对话">
                <X color={colors.text} size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View testID="ai-history-search-box" style={styles.searchBox}>
              <Search color="#777280" size={26} strokeWidth={2.2} />
              <TextInput placeholder="搜索" placeholderTextColor="#777280" style={styles.searchInput} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerList}>
              {groups.length > 0 ? groups.map((group) => (
                <View key={group.title} style={styles.historyGroup}>
                  <Text style={styles.historyGroupTitle}>{group.title}</Text>
                  {group.items.map((conversation) => {
                    const selected = selectedConversationId === conversation.id;
                    return (
                      <View key={conversation.id} testID={`ai-history-row-${conversation.id}`} style={[styles.drawerItem, selected ? styles.drawerItemSelected : null]}>
                        <Pressable
                          testID={`ai-history-title-${conversation.id}`}
                          onPress={() => onPick(conversation)}
                          style={({ pressed }) => [styles.drawerItemTitlePressable, pressed ? styles.pressed : null]}
                        >
                          <Text style={styles.drawerItemText} numberOfLines={1}>{conversation.title}</Text>
                        </Pressable>
                        <Pressable
                          testID={`ai-history-delete-${conversation.id}`}
                          onPress={() => confirmDelete(conversation)}
                          style={({ pressed }) => [styles.deleteButton, pressed ? styles.pressed : null]}
                          accessibilityLabel="删除对话"
                        >
                          <Trash2 color={colors.textMuted} size={16} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )) : (
                <Text style={styles.emptyText}>暂无历史对话</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>

        <Pressable onPress={onClose} style={styles.drawerOverlay} accessibilityLabel="关闭历史对话" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  drawerScene: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  drawerPanel: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,47,159,0.16)',
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 6, height: 0 },
  },
  drawerSafe: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  drawerProfileRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panelStrong,
  },
  drawerName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  drawerNewChatButton: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pink,
  },
  drawerCloseButton: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchBox: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.18)',
    backgroundColor: colors.inputDark,
    paddingHorizontal: 13,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 8,
  },
  drawerList: {
    width: '100%',
    paddingBottom: 24,
  },
  historyGroup: {
    width: '100%',
    marginBottom: 18,
  },
  historyGroupTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  drawerItem: {
    width: '100%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 4,
    paddingLeft: 6,
    paddingRight: 2,
  },
  drawerItemSelected: {
    backgroundColor: 'rgba(255,47,159,0.12)',
  },
  drawerItemTitlePressable: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 42,
    justifyContent: 'center',
  },
  drawerItemText: {
    minWidth: 0,
    color: colors.textSoft,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  deleteButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    paddingTop: 10,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
