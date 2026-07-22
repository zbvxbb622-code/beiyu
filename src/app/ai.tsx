import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { SendHorizontal, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RecipeCard } from '@/components/mixology/RecipeCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { createMockAiReply } from '@/services/aiChatService';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients, radii, spacing } from '@/styles/mixologyTheme';
import type { ChatMessage, CocktailRecipe } from '@/types/mixology';

const starterPrompts = [
  {
    label: '清爽低负担',
    prompt: '我想喝清爽低负担，最好不要太甜，适合今晚慢慢喝。',
  },
  {
    label: '酸甜微醺',
    prompt: '想要酸甜一点，有层次但不要太烈，帮我推荐一杯。',
  },
  {
    label: '用现有酒柜',
    prompt: '请根据我的私人酒柜材料，推荐最容易做的一杯。',
  },
  {
    label: '约会第一杯',
    prompt: '今晚约会第一杯，想要好看、好入口、有记忆点。',
  },
];

export default function AiScreen() {
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { localState } = useMixology();
  const initialPrompt = useMemo(
    () => (typeof params.prompt === 'string' ? params.prompt : '我想喝酸甜一点，有龙舌兰和青柠'),
    [params.prompt]
  );
  const [input, setInput] = useState(initialPrompt);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: '告诉我你的心情、口味和手边有什么酒，我会先用本地 Mock 给你配一轮推荐。',
    },
  ]);
  const [recipes, setRecipes] = useState<CocktailRecipe[]>([]);

  const send = () => {
    const prompt = input.trim();
    if (!prompt) {
      return;
    }

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
    setInput('');
  };

  return (
    <ScreenShell padded={false}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <LinearGradient colors={gradients.cta} style={styles.aiIcon}>
            <Sparkles color={colors.text} size={23} />
          </LinearGradient>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Mixology AI</Text>
            <View style={styles.privacyRow}>
              <ShieldCheck color={colors.pink} size={14} />
              <Text style={styles.subtitle}>本地 Mock 聊天，不上传输入内容</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.chat} showsVerticalScrollIndicator={false} contentContainerStyle={styles.chatContent}>
          <View style={styles.starterCard}>
            <Text style={styles.starterKicker}>AI 调酒入口</Text>
            <Text style={styles.starterTitle}>今晚想喝什么？</Text>
            <Text style={styles.starterText}>先选一个场景，或直接在底部输入口味、心情、库存材料。</Text>
            <View style={styles.promptGrid}>
              {starterPrompts.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => setInput(item.prompt)}
                  style={({ pressed }) => [styles.promptChip, pressed ? styles.pressed : null]}>
                  <Text style={styles.promptText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {messages.map((message) => (
            <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={styles.bubbleText}>{message.text}</Text>
            </View>
          ))}

          {recipes.length > 0 ? (
            <View style={styles.results}>
              <Text style={styles.resultsTitle}>为你推荐</Text>
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputDock}>
          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="比如：想要清爽低负担，适合女生喝"
              placeholderTextColor="#786873"
              multiline
              style={styles.input}
            />
            <Pressable onPress={send} style={styles.sendButton}>
              <LinearGradient colors={gradients.cta} style={styles.sendGradient}>
                <SendHorizontal color={colors.text} size={22} />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.pageX,
    paddingTop: 12,
    paddingBottom: 12,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.pink,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 8,
    paddingBottom: 18,
  },
  starterCard: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.22)',
    padding: 16,
    marginBottom: 16,
  },
  starterKicker: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: '900',
  },
  starterTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 6,
  },
  starterText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 14,
  },
  promptChip: {
    borderRadius: radii.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  promptText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginBottom: 10,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,47,159,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,47,159,0.36)',
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  results: {
    marginTop: 8,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
  },
  inputDock: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 10,
    paddingBottom: spacing.bottomNavPadding + 8,
    backgroundColor: 'rgba(8,0,4,0.92)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 102,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
