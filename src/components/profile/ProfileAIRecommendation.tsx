import { type Href, useRouter } from 'expo-router';
import { Bot, ChevronRight } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';
import { colors, radii } from '@/styles/mixologyTheme';

export function ProfileAIRecommendation() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.titleBar} />
          <Text style={styles.title}>为你推荐</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/ai' as Href)}
        style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      >
        <View style={styles.card}>
          <Image source={getImageAsset('oldFashioned')} style={styles.thumb} />
          <View style={styles.body}>
            <View style={styles.aiTag}>
              <Bot color={colors.cyan} size={13} />
              <Text style={styles.aiTagText}>AI 调酒师</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              今晚来杯 · 古典 Old Fashioned
            </Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              根据你的酒柜：波本威士忌 + 苦精已就绪，只差一块冰。
            </Text>
          </View>
          <View style={styles.goWrap}>
            <Text style={styles.go}>查看配方</Text>
            <ChevronRight color={colors.pink} size={15} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 2,
    marginBottom: 13,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBar: {
    width: 4,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.pink,
    marginRight: 9,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  pressable: {
    borderRadius: radii.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    backgroundColor: colors.bgDeep,
    marginRight: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiTagText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginLeft: 5,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  goWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  go: {
    color: colors.pink,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 2,
  },
});
