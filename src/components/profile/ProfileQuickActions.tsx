import { type Href, useRouter } from 'expo-router';
import { Bot, Boxes, Heart, Martini, PackageOpen } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radii } from '@/styles/mixologyTheme';

type ActionItem = {
  id: string;
  label: string;
  icon: ReactNode;
  route: Href;
  testID?: string;
};

const actions: ActionItem[] = [
  {
    id: 'private-cellar',
    label: '私人酒柜',
    icon: <Boxes color={colors.pink} size={20} />,
    route: '/private-cellar' as Href,
    testID: 'profile-action-private-cellar',
  },
  {
    id: 'shared-cellar',
    label: '大家酒柜',
    icon: <Martini color={colors.acid} size={20} />,
    route: '/cellar?from=profile' as Href,
  },
  {
    id: 'blind-box',
    label: '经典盲盒',
    icon: <PackageOpen color={colors.amber} size={20} />,
    route: '/blind-box' as Href,
  },
  {
    id: 'ai',
    label: 'AI 调酒',
    icon: <Bot color={colors.cyan} size={20} />,
    route: '/ai' as Href,
  },
  {
    id: 'bars',
    label: '附近酒吧',
    icon: <Heart color={colors.pink} size={20} />,
    route: '/bars' as Href,
  },
];

export function ProfileQuickActions() {
  const router = useRouter();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          testID={action.testID}
          onPress={() => router.push(action.route)}
          style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null]}
        >
          {action.icon}
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingVertical: 2,
  },
  pill: {
    minHeight: 56,
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
