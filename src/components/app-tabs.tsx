import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { colors } from '@/styles/mixologyTheme';

export const tabIconMetrics = {
  frameSize: 28,
  glyphSize: 24,
  aiBubbleSize: 55,
  aiGlyphSize: 30,
  aiGlyphSource: 'inline-svg',
} as const;

// 底部导航用内联 SVG：不依赖低清 PNG 抠图，也避免 lucide 图标在 Expo 端版本差异导致不渲染
function svgColor(color: ColorValue) {
  return color as string;
}

function TabGlyph({ icon, color }: { icon: 'home' | 'community' | 'bars' | 'profile'; color: ColorValue }) {
  const stroke = svgColor(color);
  const glyph = tabIconMetrics.glyphSize;

  if (icon === 'home') {
    return (
      <View style={styles.tabIconFrame}>
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
          <Path d="M3.5 10.8 12 3.5l8.5 7.3v8.2a1.8 1.8 0 0 1-1.8 1.8h-4.1v-5.6H9.4v5.6H5.3a1.8 1.8 0 0 1-1.8-1.8z" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    );
  }

  if (icon === 'community') {
    return (
      <View style={styles.tabIconFrame}>
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={6.2} stroke={stroke} strokeWidth={1.9} />
          <Ellipse cx={12} cy={12} rx={10.2} ry={3.9} stroke={stroke} strokeWidth={1.7} transform="rotate(-22 12 12)" />
        </Svg>
      </View>
    );
  }

  if (icon === 'bars') {
    return (
      <View style={styles.tabIconFrame}>
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
          <Path d="M4.5 5.5h15L12 13z" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 13v6.5" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" />
          <Path d="M8.2 20h7.6" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  return (
    <View style={styles.tabIconFrame}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={8.4} stroke={stroke} strokeWidth={2} />
        <Circle cx={9.3} cy={10.2} r={1.05} fill={stroke} />
        <Circle cx={14.7} cy={10.2} r={1.05} fill={stroke} />
        <Path d="M8.6 14.7c1.7 1.9 5.1 1.9 6.8 0" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// 中央粉色圆钮：内联白色笑脸对话 glyph，避免 PNG 在原生端偶发空白
function AiTabIcon() {
  return (
    <LinearGradient colors={['#ff2f9d', '#ff3250']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBubble}>
      <Svg testID="ai-tab-glyph" width={tabIconMetrics.aiGlyphSize} height={tabIconMetrics.aiGlyphSize} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12.2C5 8.4 8.2 5.4 12 5.4s7 3 7 6.8S15.8 19 12 19c-.9 0-1.8-.16-2.6-.48L6 19.4l.9-3.1A6.6 6.6 0 0 1 5 12.2Z" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={9.4} cy={11.2} r={0.9} fill="#fff" />
        <Circle cx={14.6} cy={11.2} r={0.9} fill="#fff" />
        <Path d="M9.2 14.3c1.4 1.2 4.2 1.2 5.6 0" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M17.2 4.2v3.2M15.6 5.8h3.2" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </LinearGradient>
  );
}

const hiddenRouteOptions = {
  href: null,
  tabBarStyle: { display: 'none' },
} as const;

export const hiddenTabRouteNames = [
  'login',
  'terms',
  'privacy',
  'cellar',
  'private-cellar',
  'cellar-ingredients',
  'recipes',
  'recipe/[id]',
  'post/[id]',
  'bar/[id]',
  'cellar-card/[id]',
  'search',
  'publish-post',
  'blind-box',
  'drink-knowledge',
  'edit-profile',
  'settings',
  'settings-ai-memory',
  'account-security',
  'settings-general',
  'settings-notifications',
  'settings-notifications-comments',
  'settings-notifications-messages',
  'settings-notifications-author',
  'settings-language',
  'settings-privacy',
  'settings-privacy-find-me',
  'settings-privacy-recommend-to-me',
  'settings-privacy-recommend-me-to',
  'settings-privacy-block-from-view',
  'settings-privacy-block-view',
  'settings-privacy-blacklist',
  'settings-privacy-one-click-protection',
  'settings-privacy-who-can-dm',
  'settings-privacy-who-can-comment',
  'settings-privacy-who-can-at',
  'settings-privacy-chat-tag',
  'settings-privacy-online-status',
  'settings-privacy-follow-fans',
  'settings-privacy-favorites',
  'settings-privacy-system-permissions',
  'settings-privacy-personalize',
  'device-management',
  'realname-verify',
  'official-verify',
  'account-recovery',
] as const;

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
      {hiddenTabRouteNames.map((routeName) => (
        <Tabs.Screen key={routeName} name={routeName} options={hiddenRouteOptions} />
      ))}
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
  tabIconFrame: {
    width: tabIconMetrics.frameSize,
    height: tabIconMetrics.frameSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  icon: {
    marginBottom: 2,
  },
  aiBubble: {
    width: tabIconMetrics.aiBubbleSize,
    height: tabIconMetrics.aiBubbleSize,
    borderRadius: tabIconMetrics.aiBubbleSize / 2,
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
});
