import { Martini, RotateCcw } from 'lucide-react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { NeonRecipeCard } from '@/components/mixology/NeonRecipeCard';
import type { AiMessageResponse, MemoryChange } from '@/services/ai/aiSchemas';
import type { AiViewStatus } from '@/state/AiState';
import { colors } from '@/styles/mixologyTheme';
import type { CocktailRecipe } from '@/types/mixology';

export function AiMessageList({
  title,
  messages,
  status,
  error,
  memoryChanges,
  recipesById,
  avatarSource,
  onOpenRecipe,
  onRetry,
}: {
  title: string;
  messages: AiMessageResponse[];
  status: AiViewStatus;
  error: string | null;
  memoryChanges: MemoryChange[];
  recipesById: Map<string, CocktailRecipe>;
  avatarSource: ImageSourcePropType;
  onOpenRecipe: (recipeId: string) => void;
  onRetry: () => void;
}) {
  const hasConversation = messages.length > 0;

  if (!hasConversation) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>今天想喝什么？</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.messageList}>
      <Text style={styles.threadTitle} numberOfLines={1}>{title}</Text>
      {messages.map((message) => (
        <View key={message.id}>
          <MessageBubble message={message} avatarSource={avatarSource} />
          {message.role === 'ASSISTANT' ? (
            <RecipeCards message={message} recipesById={recipesById} onOpenRecipe={onOpenRecipe} />
          ) : null}
        </View>
      ))}
      {memoryChanges.length > 0 ? (
        <Text style={styles.memoryNotice} numberOfLines={2}>已记住：{memoryChanges[0].summary}</Text>
      ) : null}
      {status === 'sending' ? <Text style={styles.loadingText}>正在调制回复…</Text> : null}
      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          {status === 'retryableError' ? (
            <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}>
              <RotateCcw color={colors.text} size={15} />
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function RecipeCards({
  message,
  recipesById,
  onOpenRecipe,
}: {
  message: AiMessageResponse;
  recipesById: Map<string, CocktailRecipe>;
  onOpenRecipe: (recipeId: string) => void;
}) {
  const recipes = (message.recipeIds ?? [])
    .map((recipeId) => recipesById.get(recipeId))
    .filter((recipe): recipe is CocktailRecipe => Boolean(recipe));
  if (recipes.length === 0) return null;
  return (
    <View style={styles.recipeStack}>
      {recipes.map((recipe) => (
        <Pressable key={recipe.id} onPress={() => onOpenRecipe(recipe.id)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
          <NeonRecipeCard
            title={recipe.name}
            script={recipe.englishName}
            meta="经典调酒 / 调酒师高鹏"
            ingredients={recipe.ingredients}
            steps={recipe.steps}
            style={styles.recipeCard}
          />
        </Pressable>
      ))}
    </View>
  );
}

function MessageBubble({
  message,
  avatarSource,
}: {
  message: AiMessageResponse;
  avatarSource: ImageSourcePropType;
}) {
  if (message.role === 'USER') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
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
        {message.content.split('\n').map((line, index) =>
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

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
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
  recipeStack: {
    marginLeft: 44,
    marginBottom: 12,
  },
  recipeCard: {
    marginTop: 4,
    marginBottom: 8,
  },
  memoryNotice: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(47,231,255,0.22)',
    backgroundColor: 'rgba(47,231,255,0.08)',
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 44,
    marginBottom: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 44,
    marginBottom: 12,
  },
  errorBlock: {
    alignSelf: 'flex-start',
    marginLeft: 44,
    marginBottom: 14,
  },
  errorText: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: colors.panelStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
