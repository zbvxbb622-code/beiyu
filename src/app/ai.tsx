import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { ChevronDown, MessageCirclePlus, Menu } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiHistoryDrawer } from '@/components/ai/AiHistoryDrawer';
import { AiInputDock } from '@/components/ai/AiInputDock';
import { AiMessageList } from '@/components/ai/AiMessageList';
import { useContent } from '@/state/ContentState';
import { useAi } from '@/state/AiState';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients } from '@/styles/mixologyTheme';
import { resolveAvatarSource } from '@/utils/profileFeed';

function promptClientId() {
  return Crypto.randomUUID?.() ?? `prompt-${Date.now()}`;
}

export default function AiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const ai = useAi();
  const { snapshot } = useContent();
  const { userProfile } = useMixology();
  const { width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAiReady = ai.isReady;
  const aiMode = ai.mode;
  const sendMessage = ai.send;
  const loadConversations = ai.loadConversations;
  const initialPrompt = useMemo(() => (typeof params.prompt === 'string' ? params.prompt.trim() : ''), [params.prompt]);
  const consumedPromptRef = useRef<string | null>(null);
  const promptClientIdRef = useRef<string | null>(null);
  const avatarSource = resolveAvatarSource(userProfile ?? { avatarKey: 'avatarOne', avatarUri: null });
  const displayName = userProfile?.nickname?.trim() || 'lan Bai';
  const title = ai.mode === 'temporary'
    ? '临时对话'
    : ai.selectedConversation?.title ?? '新的对话';
  const recipesById = useMemo(
    () => new Map(snapshot.recipes.map((recipe) => [recipe.id, recipe])),
    [snapshot.recipes]
  );

  useEffect(() => {
    if (!isAiReady || aiMode === 'temporary' || !initialPrompt) return;
    if (consumedPromptRef.current === initialPrompt) return;
    consumedPromptRef.current = initialPrompt;
    promptClientIdRef.current = promptClientIdRef.current ?? promptClientId();
    void sendMessage(initialPrompt, promptClientIdRef.current);
  }, [aiMode, initialPrompt, isAiReady, sendMessage]);

  useEffect(() => {
    if (isAiReady) {
      void loadConversations();
    }
  }, [isAiReady, loadConversations]);

  const openRecipe = (recipeId: string) => {
    router.push({ pathname: '/recipe/[id]', params: { id: recipeId } } as unknown as Href);
  };

  const startNewChat = () => {
    ai.startNewChat();
    setDrawerOpen(false);
  };

  const startTemporaryChat = () => {
    ai.startTemporaryChat();
    setDrawerOpen(false);
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

            <Pressable onPress={startNewChat} style={styles.modelSelector}>
              <View style={styles.modelCopy}>
                <View style={styles.modelTitleRow}>
                  <Text style={styles.modelTitle}>V0-Bartender</Text>
                  <ChevronDown color={colors.text} size={15} strokeWidth={2.8} />
                </View>
                {ai.mode === 'temporary' ? <Text style={styles.tempLabel}>临时对话</Text> : null}
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
            <AiMessageList
              title={title}
              messages={ai.messages}
              status={ai.status}
              error={ai.error}
              memoryChanges={ai.lastMemoryChanges}
              recipesById={recipesById}
              avatarSource={avatarSource}
              onOpenRecipe={openRecipe}
              onRetry={ai.retry}
            />
          </View>

          <AiInputDock
            draft={ai.draft}
            status={ai.status}
            mode={ai.mode}
            usage={ai.usage}
            onChangeDraft={ai.setDraft}
            onSend={ai.send}
            onOpenTools={() => setDrawerOpen(true)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <AiHistoryDrawer
        visible={drawerOpen}
        width={width}
        avatarSource={avatarSource}
        displayName={displayName}
        conversations={ai.conversations}
        selectedConversationId={ai.selectedConversation?.id ?? null}
        onClose={() => setDrawerOpen(false)}
        onNewChat={startNewChat}
        onPick={(conversation) => {
          setDrawerOpen(false);
          void ai.selectConversation(conversation);
        }}
        onDelete={(conversationId) => {
          void ai.deleteConversation(conversationId);
        }}
      />
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
});
