import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { colors, spacing, touchTarget } from '@/styles/mixologyTheme';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScreenShell padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10} testID="legal-back-button">
            <ChevronLeft color={colors.text} size={26} />
          </Pressable>
          <Text style={styles.headerTitle}>隐私说明</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>杯语隐私说明</Text>
          <Text style={styles.paragraph}>
            我们只收集实现账号登录、内容发布、AI 对话和安全保护所必需的信息，并按你的隐私设置控制本地保存与同步。
          </Text>
          <Text style={styles.sectionTitle}>实名认证</Text>
          <Text style={styles.paragraph}>
            姓名与身份证号仅用于本次年龄或实名表单校验。当前版本不会把姓名和身份证号写入本机持久化存储、设备日志或 AI 对话上下文；正式上线实名能力需接入服务端实名核验服务。
          </Text>
          <Text style={styles.sectionTitle}>AI 对话</Text>
          <Text style={styles.paragraph}>
            普通 AI 对话用于生成回复和历史记录。开启临时对话后，本次内容不会保存到历史记录或本地持久化状态。
          </Text>
          <Text style={styles.sectionTitle}>你的选择</Text>
          <Text style={styles.paragraph}>
            你可以在设置中管理隐私选项、AI 记忆和账号安全。删除账号后，我们会按法律法规和产品规则处理相关数据。
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
