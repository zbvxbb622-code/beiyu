import { type Href, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';

export type PickerOption = {
  id: string;
  label: string;
  description?: string;
};

/**
 * 二级「单选 picker」页（仿小红书）：从 options 中选一项，选中行右侧显示红色 Check。
 *
 * 用途：谁可以私信我 / 谁可以评论 / 在线状态 / 关注与粉丝列表可见性 等互斥选项场景。
 */
export function PrivacyPickerScreen({
  title,
  initialSelected,
  options,
  description,
}: {
  title: string;
  initialSelected: string;
  options: PickerOption[];
  description?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected);

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Header title={title} onBack={() => router.replace('/settings-privacy' as Href)} />

        <View style={styles.body}>
          {description ? <Text style={styles.description}>{description}</Text> : null}

          <View style={styles.card}>
            {options.map((opt, index) => {
              const isSelected = selected === opt.id;
              const isLast = index === options.length - 1;
              return (
                <PickerRow
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  isSelected={isSelected}
                  isLast={isLast}
                  onPress={() => setSelected(opt.id)}
                  testID={`privacy-picker-${opt.id}`}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

/**
 * 二级「多 toggle 列表」页（仿小红书）：每行一个 iOS 风格的 Toggle。
 *
 * 用途：找到我的方式 / 聊天标识 / 个性化选项 等多开关场景。
 */
export function PrivacyToggleScreen({
  title,
  initialValues,
  rows,
  description,
}: {
  title: string;
  initialValues: Record<string, boolean>;
  rows: { id: string; label: string; description?: string }[];
  description?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, boolean>>(initialValues);

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Header title={title} onBack={() => router.replace('/settings-privacy' as Href)} />

        <View style={styles.body}>
          {description ? <Text style={styles.description}>{description}</Text> : null}

          <View style={styles.card}>
            {rows.map((row, index) => {
              const isLast = index === rows.length - 1;
              const value = values[row.id] ?? false;
              return (
                <ToggleRow
                  key={row.id}
                  label={row.label}
                  description={row.description}
                  value={value}
                  isLast={isLast}
                  onToggle={() =>
                    setValues((prev) => ({ ...prev, [row.id]: !(prev[row.id] ?? false) }))
                  }
                  testID={`privacy-toggle-${row.id}`}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

/**
 * 二级「空列表 / 引导」页（仿小红书）：黑名单、不让他看 等用户列表类页面的占位。
 */
export function PrivacyEmptyScreen({
  title,
  illustration,
  emptyTitle,
  emptyDescription,
  actionLabel,
  onAction,
}: {
  title: string;
  illustration?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const router = useRouter();

  return (
    <ScreenShell padded={false}>
      <View style={styles.flexContainer}>
        <Header title={title} onBack={() => router.replace('/settings-privacy' as Href)} />

        <View style={styles.emptyContainer}>
          {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          {emptyDescription ? (
            <Text style={styles.emptyDescription}>{emptyDescription}</Text>
          ) : null}
          {actionLabel ? (
            <Pressable
              onPress={onAction}
              style={({ pressed }) => [
                styles.actionPressable,
                pressed ? styles.pressed : null,
              ]}
              testID="privacy-empty-action"
            >
              <View style={styles.actionInner}>
                <Text style={styles.actionText}>{actionLabel}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScreenShell>
  );
}

/**
 * 二级「系统权限说明」页（仿小红书）：列出几类系统权限，每行点击进入 OS 设置（占位）。
 */
export function PrivacySystemPermissionsScreen({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; label: string; description: string; status: 'granted' | 'denied' }[];
}) {
  const router = useRouter();

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Header title={title} onBack={() => router.replace('/settings-privacy' as Href)} />

        <View style={styles.body}>
          <Text style={styles.description}>
            APP 内使用的所有系统权限，点击对应权限可前往系统设置调整。
          </Text>

          <View style={styles.card}>
            {rows.map((row, index) => {
              const isLast = index === rows.length - 1;
              return (
                <SystemRow
                  key={row.id}
                  label={row.label}
                  description={row.description}
                  status={row.status}
                  isLast={isLast}
                  testID={`privacy-system-${row.id}`}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

// —— 内部组件 ——

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
        testID={`header-back-${title}`}
      >
        <View style={styles.headerSideInner}>
          <ChevronLeft color={colors.text} size={26} />
        </View>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSidePlaceholder} />
    </View>
  );
}

function PickerRow({
  label,
  description,
  isSelected,
  isLast,
  onPress,
  testID,
}: {
  label: string;
  description?: string;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const inner = (
    <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {isSelected ? (
        <Check color={colors.red} size={20} strokeWidth={2.5} />
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowPressable, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {inner}
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  value,
  isLast,
  onToggle,
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  isLast: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const inner = (
    <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      <ToggleSwitch value={value} onToggle={onToggle} />
    </View>
  );

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.rowPressable, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {inner}
    </Pressable>
  );
}

/** 极简 iOS Toggle：白轨（关）/ 红轨（开），圆点滑动。点击 Pressable 切换。 */
function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <View style={[styles.toggleTrack, value ? styles.toggleOn : styles.toggleOff]}>
      <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
    </View>
  );
}

function SystemRow({
  label,
  description,
  status,
  isLast,
  testID,
}: {
  label: string;
  description: string;
  status: 'granted' | 'denied';
  isLast: boolean;
  testID?: string;
}) {
  return (
    <View style={[styles.rowPressable]} testID={testID}>
      <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowTitle}>{label}</Text>
          <Text style={styles.rowDescription}>{description}</Text>
        </View>
        <Text style={[styles.statusLabel, status === 'granted' ? styles.statusGranted : styles.statusDenied]}>
          {status === 'granted' ? '已授权' : '未授权'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.bottomNavPadding },
  flexContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerSidePressable: {
    width: touchTarget.min,
    height: touchTarget.min,
  },
  headerSideInner: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSidePlaceholder: {
    width: touchTarget.min,
    height: touchTarget.min,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
    marginLeft: 4,
    marginRight: 4,
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.panelSoft,
    overflow: 'hidden',
  },
  rowPressable: { minHeight: 54, justifyContent: 'center' },
  rowInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowTextWrap: { flex: 1 },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  // —— Toggle ——
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  toggleOn: { justifyContent: 'flex-end', backgroundColor: colors.red },
  toggleOff: { justifyContent: 'flex-start', backgroundColor: colors.panelStrong },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  toggleThumbOn: {},
  toggleThumbOff: {},
  // —— Empty ——
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pageX,
  },
  illustration: { marginBottom: 20 },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actionPressable: { marginTop: 18 },
  actionInner: {
    minHeight: 38,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  // —— System permissions status ——
  statusLabel: { fontSize: 13, fontWeight: '600' },
  statusGranted: { color: colors.acid },
  statusDenied: { color: colors.textMuted },
  pressed: { opacity: 0.72 },
});