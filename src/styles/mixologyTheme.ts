export const colors = {
  bg: '#070004',
  bgDeep: '#120006',
  panel: '#151112',
  panelSoft: 'rgba(255,255,255,0.08)',
  panelStrong: 'rgba(255,255,255,0.12)',
  text: '#ffffff',
  textMuted: '#a99ca3',
  textSoft: '#d8cfd4',
  pink: '#ff2f9f',
  pinkDark: '#c50b52',
  red: '#ff3038',
  cyan: '#2fe7ff',
  acid: '#b7ff4a',
  amber: '#ffb84d',
  border: 'rgba(255,255,255,0.12)',
  shadowPink: 'rgba(255,47,159,0.35)',
  // —— 设计稿还原专用 token ——
  // 底部 Tab 栏实心深色背景
  tabBarBg: '#0d0208',
  // 卡片底（酒吧列表卡片）
  cardDark: '#181013',
  // 首页四宫格图标底板
  shortcutBg: 'rgba(255,47,159,0.10)',
  shortcutBorder: 'rgba(255,47,159,0.22)',
  // 搜索框/输入框描边粉
  outlinePink: 'rgba(255,47,159,0.55)',
  // Hero「去AI调酒」暗红按钮
  ctaDarkRed: '#9e2c40',
  // 聊天气泡
  chatUserBubble: '#2c2126',
  chatPanel: '#1c1216',
  // 评论输入框底
  inputDark: '#2b1e24',
};

export const gradients = {
  app: ['#080004', '#160006', '#050002'] as const,
  cta: ['#ff2f9f', '#ff3038'] as const,
  card: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)'] as const,
  overlayTop: ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)'] as const,
  overlayBottom: ['rgba(0,0,0,0)', 'rgba(7,0,4,0.96)'] as const,
};

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const spacing = {
  pageX: 20,
  pageXCompact: 16,
  bottomNavPadding: 120,
};

// 触控目标最小尺寸（iOS HIG / Android Material）
export const touchTarget = {
  min: 44,
  comfortable: 48,
};

// 字体大小适配（小屏手机用 compact）
export const typography = {
  heroTitle: { fontSize: 28, lineHeight: 38 },
  heroTitleCompact: { fontSize: 24, lineHeight: 32 },
  sectionTitle: 20,
  body: 15,
  bodySmall: 13,
};
