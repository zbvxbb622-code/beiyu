import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  Martini,
  MessageCirclePlus,
  Menu,
  Mic,
  Plus,
  Search,
  Send,
  Sparkles,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NeonRecipeCard } from '@/components/mixology/NeonRecipeCard';
import { createMockAiReply } from '@/services/aiChatService';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients } from '@/styles/mixologyTheme';
import type { ChatMessage, CocktailRecipe } from '@/types/mixology';
import { resolveAvatarSource } from '@/utils/profileFeed';

const historyYesterday = [
  '系统代理管理员权限错误',
  '企业微信接口接入指南',
  '知识库训练方法',
];

const historyWeek = [
  '后端开发技术要点',
  '穿搭潮流解析',
  '上海城市优势解析',
  '穿搭搭配推荐',
  '工作流搭建概念',
  '2006 年出生年龄计算',
  'MCN 公司运营解析',
  '心碎后的回应',
  '青浦至静安大融城出行建议',
  'M1到 M5芯片升级解析',
];

function deriveTitle(text: string) {
  if (text.includes('玛格丽特')) return '玛格丽特的变化';
  if (text.includes('金汤力')) return '金汤力的变化';
  if (text.includes('夏日甜橙')) return '夏日甜橙的变化';
  if (text.includes('莫吉托')) return '莫吉托的变化';
  return '新的对话';
}

function createPromptConversation(prompt: string, selectedIngredientIds: string[]) {
  const result = createMockAiReply(
    {
      prompt,
      selectedIngredientIds,
    },
    `assistant-initial-${prompt}`
  );

  const userMessage: ChatMessage = {
    id: `user-initial-${prompt}`,
    role: 'user',
    text: prompt,
  };

  return {
    messages: [userMessage, result.message],
    recipes: result.recipes,
  };
}

export default function AiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { localState, userProfile } = useMixology();
  const { width } = useWindowDimensions();
  const initialPrompt = useMemo(() => (typeof params.prompt === 'string' ? params.prompt.trim() : ''), [params.prompt]);
  const initialConversation = useMemo(
    () => (initialPrompt ? createPromptConversation(initialPrompt, localState.cellarIngredientIds) : null),
    [initialPrompt, localState.cellarIngredientIds]
  );
  const avatarSource = resolveAvatarSource(userProfile ?? { avatarKey: 'avatarOne', avatarUri: null });
  const displayName = userProfile?.nickname?.trim() || 'lan Bai';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState(() => deriveTitle(initialPrompt));
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialConversation?.messages ?? []);
  const [recipes, setRecipes] = useState<CocktailRecipe[]>(() => initialConversation?.recipes ?? []);
  const [cardGenerated, setCardGenerated] = useState(false);
  const [isTemporary, setIsTemporary] = useState(false);

  const hasConversation = messages.length > 0;

  const startPromptChat = (seedText: string) => {
    const prompt = seedText.trim();
    if (!prompt) return;

    const nextConversation = createPromptConversation(prompt, localState.cellarIngredientIds);
    setMessages(nextConversation.messages);
    setRecipes(nextConversation.recipes);
    setCardGenerated(false);
    setIsTemporary(false);
    setTitle(deriveTitle(prompt));
    setInput('');
    setDrawerOpen(false);
  };

  const resetChat = () => {
    setMessages([]);
    setRecipes([]);
    setCardGenerated(false);
    setIsTemporary(false);
    setTitle('新的对话');
    setInput('');
    setDrawerOpen(false);
  };

  const startTemporaryChat = () => {
    setMessages([]);
    setRecipes([]);
    setCardGenerated(false);
    setIsTemporary(true);
    setTitle('临时对话');
    setInput('');
    setDrawerOpen(false);
  };

  const openRecipe = (recipeId: string) => {
    router.push({ pathname: '/recipe/[id]', params: { id: recipeId } } as unknown as Href);
  };

  const send = () => {
    const prompt = input.trim();
    if (!prompt) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
    };
    const result = createMockAiReply({
      prompt,
      selectedIngredientIds: localState.cellarIngredientIds,
    });

    setMessages((current) => [...current, userMessage, result.message]);
    setRecipes(result.recipes);
    setCardGenerated(false);
    setTitle((currentTitle) => (isTemporary ? currentTitle : deriveTitle(prompt)));
    setInput('');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable
              testID="ai-menu-button"
              onPress={() => setDrawerOpen(true)}
              style={styles.headerIcon}
              hitSlop={12}
              accessibilityLabel="打开历史对话">
              <Menu color="#f7f7f7" size={31} strokeWidth={2.4} />
            </Pressable>

            <Pressable onPress={resetChat} style={styles.modelSelector}>
              <View style={styles.modelCopy}>
                <View style={styles.modelTitleRow}>
                  <Text style={styles.modelTitle}>V0-Bartender</Text>
                  <ChevronDown color={colors.text} size={15} strokeWidth={2.8} />
                </View>
                {isTemporary ? <Text style={styles.tempLabel}>临时对话</Text> : null}
              </View>
            </Pressable>

            <Pressable
              testID="ai-temp-chat-button"
              onPress={startTemporaryChat}
              style={({ pressed }) => [styles.headerActionButton, pressed ? styles.pressed : null]}
              hitSlop={12}
              accessibilityLabel="临时聊天">
              <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerActionGradient}>
                <MessageCirclePlus color={colors.text} size={21} strokeWidth={2.3} />
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.body}>
            {hasConversation ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.messageList}>
                <Text style={styles.threadTitle} numberOfLines={1}>{title}</Text>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} avatarSource={avatarSource} />
                ))}

                {recipes.length > 0 && !cardGenerated ? (
                  <Pressable onPress={() => setCardGenerated(true)} style={({ pressed }) => [styles.generateButton, pressed ? styles.pressed : null]}>
                    <Sparkles color="#ffffff" size={17} />
                    <Text style={styles.generateText}>生成配方</Text>
                  </Pressable>
                ) : null}

                {cardGenerated && recipes[0] ? (
                  <Pressable onPress={() => openRecipe(recipes[0].id)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                    <NeonRecipeCard
                      title={recipes[0].name}
                      script={recipes[0].englishName}
                      meta="经典调酒 / 调酒师高鹏"
                      ingredients={recipes[0].ingredients}
                      steps={recipes[0].steps}
                      style={styles.recipeCard}
                    />
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>今天想喝什么？</Text>
              </View>
            )}
          </View>

          <View testID="ai-input-dock" style={styles.inputDock}>
            <View style={[styles.inputPill, inputFocused ? styles.inputPillFocused : null]}>
              <Pressable onPress={() => setDrawerOpen(true)} style={styles.plusButton} accessibilityLabel="更多">
                <Plus color="#ffffff" size={29} strokeWidth={2.2} />
              </Pressable>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="询问饮品配方或寻求推荐…"
                placeholderTextColor={colors.textMuted}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onSubmitEditing={send}
                returnKeyType="send"
                style={styles.input}
              />
              <Mic color="#b7b3be" size={25} strokeWidth={2.3} />
              <Pressable testID="ai-send-button" onPress={send} style={styles.voiceButton} accessibilityLabel="发送">
                <LinearGradient
                  colors={gradients.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.voiceGradient}>
                  {input.trim() ? (
                    <Send color="#ffffff" size={21} strokeWidth={2.6} />
                  ) : (
                    <AudioLines color="#ffffff" size={25} strokeWidth={2.4} />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <HistoryDrawer
        visible={drawerOpen}
        width={width}
        avatarSource={avatarSource}
        displayName={displayName}
        onClose={() => setDrawerOpen(false)}
        onNewChat={resetChat}
        onPick={startPromptChat}
      />
    </View>
  );
}

function MessageBubble({
  message,
  avatarSource,
}: {
  message: ChatMessage;
  avatarSource: ReturnType<typeof resolveAvatarSource>;
}) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
        <Image source={avatarSource} style={styles.userAvatar} />
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantAvatar}>
        <Martini color="#ffffff" size={17} />
      </View>
      <View style={styles.assistantBubble}>
        {message.text.split('\n').map((line, index) =>
          line.startsWith('•') ? (
            <Text key={`${message.id}-${index}`} style={styles.assistantBullet}>{line}</Text>
          ) : (
            <Text key={`${message.id}-${index}`} style={styles.assistantText}>{line}</Text>
          )
        )}
      </View>
    </View>
  );
}

function HistoryDrawer({
  visible,
  width,
  avatarSource,
  displayName,
  onClose,
  onNewChat,
  onPick,
}: {
  visible: boolean;
  width: number;
  avatarSource: ReturnType<typeof resolveAvatarSource>;
  displayName: string;
  onClose: () => void;
  onNewChat: () => void;
  onPick: (item: string) => void;
}) {
  const panelWidth = Math.min(width * 0.82, 340);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerScene}>
        <View testID="ai-history-drawer" style={[styles.drawerPanel, { width: panelWidth }]}>
          <SafeAreaView style={styles.drawerSafe} edges={['top', 'bottom']}>
            <View style={styles.drawerProfileRow}>
              <Image source={avatarSource} style={styles.drawerAvatar} />
              <Text style={styles.drawerName} numberOfLines={1}>{displayName}</Text>
              <ChevronRight color="#f7f7f7" size={24} strokeWidth={2.6} />
              <Pressable onPress={onNewChat} style={styles.drawerNewChatButton} accessibilityLabel="新对话">
                <Plus color={colors.text} size={20} strokeWidth={2.6} />
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Search color="#777280" size={26} strokeWidth={2.2} />
              <TextInput
                placeholder="搜索"
                placeholderTextColor="#777280"
                style={styles.searchInput}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerList}>
              <HistoryGroup title="昨天" items={historyYesterday} onPick={onPick} />
              <HistoryGroup title="过去 7 天" items={historyWeek} onPick={onPick} />
            </ScrollView>
          </SafeAreaView>
        </View>

        <Pressable onPress={onClose} style={styles.drawerOverlay} accessibilityLabel="关闭历史对话" />
      </View>
    </Modal>
  );
}

function HistoryGroup({
  title,
  items,
  onPick,
}: {
  title: string;
  items: string[];
  onPick: (item: string) => void;
}) {
  return (
    <View style={styles.historyGroup}>
      <Text style={styles.historyGroupTitle}>{title}</Text>
      {items.map((item) => (
        <Pressable key={item} onPress={() => onPick(item)} style={({ pressed }) => [styles.drawerItem, pressed ? styles.pressed : null]}>
          <Text style={styles.drawerItemText} numberOfLines={1}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.78,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelSelector: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  modelCopy: {
    minWidth: 0,
  },
  modelTitleRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modelTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  tempLabel: {
    alignSelf: 'flex-start',
    marginTop: 2,
    color: colors.pink,
    fontSize: 12,
    fontWeight: '700',
  },
  headerActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    shadowColor: colors.pink,
    shadowOpacity: 0.26,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerActionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 78,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  messageList: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 22,
  },
  threadTitle: {
    alignSelf: 'center',
    color: '#f4f4f5',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 18,
    maxWidth: '80%',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  userBubble: {
    maxWidth: '76%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.18)',
    backgroundColor: colors.chatUserBubble,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#24242a',
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  assistantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkDark,
  },
  assistantBubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: colors.chatPanel,
  },
  assistantText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 10,
  },
  assistantBullet: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  generateButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.24)',
    backgroundColor: colors.inputDark,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  generateText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  recipeCard: {
    marginTop: 14,
    marginBottom: 8,
  },
  inputDock: {
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 10,
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
  inputPillFocused: {
    borderColor: colors.outlinePink,
    backgroundColor: '#33202a',
    shadowColor: colors.pink,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
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
  drawerScene: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  drawerPanel: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,47,159,0.16)',
    backgroundColor: colors.bgDeep,
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 6, height: 0 },
  },
  drawerSafe: {
    flex: 1,
    paddingHorizontal: 18,
  },
  drawerProfileRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.panelStrong,
  },
  drawerName: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  drawerNewChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pink,
  },
  searchBox: {
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
    paddingBottom: 24,
  },
  historyGroup: {
    marginBottom: 18,
  },
  historyGroupTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  drawerItem: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  drawerItemText: {
    color: colors.textSoft,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
