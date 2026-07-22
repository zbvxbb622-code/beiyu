import { useLocalSearchParams } from 'expo-router';
import { Martini } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SharedCellarCard } from '@/components/mixology/SharedCellarCard';
import { TopBar } from '@/components/mixology/TopBar';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getSharedCellarCards } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, spacing } from '@/styles/mixologyTheme';

export default function CellarScreen() {
  const { interactionState, toggleCellarCardLike } = useMixology();
  // 入口决定返回目标：从"我的"进来回 /profile，从首页快捷入口进来回首页
  const { from } = useLocalSearchParams<{ from?: string }>();
  const cards = getSharedCellarCards();

  return (
    <ScreenShell>
      <TopBar title="大家的酒柜" backHref={from === 'profile' ? '/profile' : '/'} right={<Martini color={colors.text} size={26} />} />
      <Text style={styles.subtitle}>公开作品广场，先用本地 Mock 展示大家分享的鸡尾酒卡片。</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {cards.map((card) => (
            <SharedCellarCard
              key={card.id}
              card={card}
              liked={interactionState.likedCellarCardIds.includes(card.id)}
              onToggleLike={() => toggleCellarCardLike(card.id)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  content: {
    paddingBottom: spacing.bottomNavPadding,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
