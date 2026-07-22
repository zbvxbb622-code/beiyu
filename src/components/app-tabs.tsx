import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { HeartHandshake, Home, Martini, MessageCircle, Sparkles, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients } from '@/styles/mixologyTheme';

function AiTabIcon({ focused }: { focused: boolean }) {
  return (
    <LinearGradient colors={gradients.cta} style={[styles.aiBubble, focused ? styles.aiBubbleFocused : null]}>
      <MessageCircle color={colors.text} size={30} />
      <Sparkles color={colors.text} size={11} style={styles.aiSparkle} />
    </LinearGradient>
  );
}

const hiddenRouteOptions = {
  href: null,
  tabBarStyle: { display: 'none' },
} as const;

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 70 + Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: '#8f7f88',
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: Math.max(insets.bottom, 10) }],
        tabBarBackground: () => <View style={styles.tabBackground} />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '社区',
          tabBarIcon: ({ color, size }) => <HeartHandshake color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <AiTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bars"
        options={{
          title: '酒吧',
          tabBarIcon: ({ color, size }) => <Martini color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="login" options={hiddenRouteOptions} />
      <Tabs.Screen name="cellar" options={hiddenRouteOptions} />
      <Tabs.Screen name="private-cellar" options={hiddenRouteOptions} />
      <Tabs.Screen name="recipes" options={hiddenRouteOptions} />
      <Tabs.Screen name="recipe/[id]" options={hiddenRouteOptions} />
      <Tabs.Screen name="post/[id]" options={hiddenRouteOptions} />
      <Tabs.Screen name="bar/[id]" options={hiddenRouteOptions} />
      <Tabs.Screen name="cellar-card/[id]" options={hiddenRouteOptions} />
      <Tabs.Screen name="search" options={hiddenRouteOptions} />
      <Tabs.Screen name="publish-post" options={hiddenRouteOptions} />
      <Tabs.Screen name="blind-box" options={hiddenRouteOptions} />
      <Tabs.Screen name="drink-knowledge" options={hiddenRouteOptions} />
      <Tabs.Screen name="edit-profile" options={hiddenRouteOptions} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingTop: 8,
    borderTopWidth: 0,
    backgroundColor: 'rgba(15,4,8,0.94)',
    elevation: 0,
  },
  tabBackground: {
    flex: 1,
    backgroundColor: 'rgba(15,4,8,0.94)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
  aiBubble: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    shadowColor: colors.pink,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  aiBubbleFocused: {
    transform: [{ scale: 1.06 }],
  },
  aiSparkle: {
    position: 'absolute',
    right: 19,
    top: 18,
  },
});
