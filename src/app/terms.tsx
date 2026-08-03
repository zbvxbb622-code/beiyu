import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { colors, spacing, touchTarget } from '@/styles/mixologyTheme';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <ScreenShell padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10} testID="legal-back-button">
            <ChevronLeft color={colors.text} size={26} />
          </Pressable>
          <Text style={styles.headerTitle}>服务协议</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>杯语用户服务协议</Text>
          <Text style={styles.paragraph}>
            杯语仅向年满 18 周岁的用户提供 AI 调酒陪伴、酒品知识和社区内容服务。使用前请确认你所在地法律允许你接触相关酒类信息。
          </Text>
          <Text style={styles.sectionTitle}>账号与内容</Text>
          <Text style={styles.paragraph}>
            你应提供真实、准确的注册信息，并对自己发布的笔记、评论和互动内容负责。不得发布违法、侵权、诱导过量饮酒或面向未成年人的内容。
          </Text>
          <Text style={styles.sectionTitle}>AI 建议</Text>
          <Text style={styles.paragraph}>
            AI 回复仅供饮品灵感参考，不构成医疗、营养、法律或安全建议。请根据个人健康状况理性判断，禁止酒后驾驶。
          </Text>
          <Text style={styles.sectionTitle}>服务变更</Text>
          <Text style={styles.paragraph}>
            我们可能因产品调整、合规要求或安全原因更新服务范围。重要变更会在应用内以适当方式提示。
          </Text>
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
  backButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerPlaceholder: {
    width: touchTarget.min,
    height: touchTarget.min,
  },
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8,
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
