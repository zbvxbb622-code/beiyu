import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { type ColorValue, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { getImageAsset } from '@/data/imageAssets';
import { colors } from '@/styles/mixologyTheme';

// 底部导航用内联 SVG：不依赖低清 PNG 抠图，也避免 lucide 图标在 Expo 端版本差异导致不渲染
function svgColor(color: ColorValue) {
  return color as string;
}

function TabGlyph({ icon, color }: { icon: 'home' | 'community' | 'bars' | 'profile'; color: ColorValue }) {
  const stroke = svgColor(color);

  if (icon === 'home') {
    return (
      <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
        <Path d="M3.5 10.8 12 3.5l8.5 7.3v8.2a1.8 1.8 0 0 1-1.8 1.8h-4.1v-5.6H9.4v5.6H5.3a1.8 1.8 0 0 1-1.8-1.8z" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (icon === 'community') {
    return (
      <Svg width={25} height={21} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={6.2} stroke={stroke} strokeWidth={1.9} />
        <Ellipse cx={12} cy={12} rx={10.2} ry={3.9} stroke={stroke} strokeWidth={1.7} transform="rotate(-22 12 12)" />
      </Svg>
    );
  }

  if (icon === 'bars') {
    return (
      <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
        <Path d="M4.5 5.5h15L12 13z" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 13v6.5" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" />
        <Path d="M8.2 20h7.6" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.4} stroke={stroke} strokeWidth={2} />
      <Circle cx={9.3} cy={10.2} r={1.05} fill={stroke} />
      <Circle cx={14.7} cy={10.2} r={1.05} fill={stroke} />
      <Path d="M8.6 14.7c1.7 1.9 5.1 1.9 6.8 0" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

// 中央粉色圆钮：渐变圆 + 设计稿抠出的白色笑脸对话 glyph（55x49px → 27.5x24.5pt）
function AiTabIcon() {
  return (
    <LinearGradient colors={['#ff2f9d', '#ff3250']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBubble}>
      <Image source={getImageAsset('tabAiGlyph')} style={styles.aiGlyph} resizeMode="contain" />
    </LinearGradient>
  );
}

const hiddenRouteOptions = {
  href: null,
  tabBarStyle: { display: 'none' },
} as const;

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  // 设计稿：栏内容区 56pt + 底部安全区
  const tabBarHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: '#8a8580',
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: bottomInset }],
        tabBarBackground: () => <View style={styles.tabBackground} />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <TabGlyph icon="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '社区',
          tabBarIcon: ({ color }) => <TabGlyph icon="community" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: '',
          tabBarIcon: () => <AiTabIcon />,
          // 设计稿：AI 页为全屏沉浸页，不显示底部 Tab 栏
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="bars"
        options={{
          title: '酒吧',
          tabBarIcon: ({ color }) => <TabGlyph icon="bars" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <TabGlyph icon="profile" color={color} />,
        }}
      />
      <Tabs.Screen name="login" options={hiddenRouteOptions} />
      <Tabs.Screen name="cellar" options={hiddenRouteOptions} />
      <Tabs.Screen name="private-cellar" options={hiddenRouteOptions} />
      <Tabs.Screen name="cellar-ingredients" options={hiddenRouteOptions} />
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
      <Tabs.Screen name="settings" options={hiddenRouteOptions} />
      <Tabs.Screen name="account-security" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-general" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-notifications" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-notifications-comments" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-notifications-messages" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-notifications-author" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-language" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-find-me" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-recommend-to-me" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-recommend-me-to" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-block-from-view" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-block-view" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-blacklist" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-one-click-protection" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-who-can-dm" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-who-can-comment" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-who-can-at" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-chat-tag" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-online-status" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-follow-fans" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-favorites" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-system-permissions" options={hiddenRouteOptions} />
      <Tabs.Screen name="settings-privacy-personalize" options={hiddenRouteOptions} />
      <Tabs.Screen name="device-management" options={hiddenRouteOptions} />
      <Tabs.Screen name="realname-verify" options={hiddenRouteOptions} />
      <Tabs.Screen name="official-verify" options={hiddenRouteOptions} />
      <Tabs.Screen name="account-recovery" options={hiddenRouteOptions} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    // 设计稿 Tab 栏背景：暖黑 #100a0a
    backgroundColor: '#100a0a',
    elevation: 0,
  },
  tabBackground: {
    flex: 1,
    backgroundColor: '#100a0a',
  },
  tabItem: {
    borderRadius: 14,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  icon: {
    marginBottom: 2,
  },
  aiBubble: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    alignItems: 'center',
    justifyContent: 'center',
    // 设计上浮：圆心距栏顶 15pt（凸出栏顶 12.5pt）
    marginBottom: 13,
    shadowColor: '#ff2f9d',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  aiGlyph: {
    width: 27.5,
    height: 24.5,
  },
});
