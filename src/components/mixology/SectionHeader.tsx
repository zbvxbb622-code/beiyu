import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/styles/mixologyTheme';

// 可复用的分区标题：左侧品牌色竖条 + 主副标题，统一各板块之间的视觉节奏。
export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.root} testID="section-header">
      <View style={styles.accent} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 14,
  },
  accent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.pink,
    marginRight: 10,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
