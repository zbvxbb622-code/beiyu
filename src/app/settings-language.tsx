import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';

type LanguageCode = 'zh-CN' | 'zh-TW' | 'en';

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁体中文' },
  { code: 'en', label: 'English' },
];

export default function SettingsLanguageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<LanguageCode>('zh-CN');
  const isDirty = selected !== 'zh-CN';

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/settings' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="settings-language-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>多语言和翻译</Text>
          <Pressable
            onPress={() => router.replace('/settings' as Href)}
            style={({ pressed }) => [
              styles.savePressable,
              pressed && isDirty ? styles.pressed : null,
            ]}
            disabled={!isDirty}
            testID="settings-language-save"
          >
            <View
              style={[styles.saveInner, isDirty ? styles.saveInnerEnabled : styles.saveInnerDisabled]}
            >
              <Text
                style={[
                  styles.saveText,
                  isDirty ? styles.saveTextEnabled : styles.saveTextDisabled,
                ]}
              >
                保存
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.groupLabel}>选择语言</Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => {
              const isSelected = selected === lang.code;
              const isLast = index === LANGUAGES.length - 1;
              return (
                <Row
                  key={lang.code}
                  label={lang.label}
                  isSelected={isSelected}
                  isLast={isLast}
                  onPress={() => setSelected(lang.code)}
                  testID={`settings-language-${lang.code}`}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function Row({
  label,
  isSelected,
  isLast,
  onPress,
  testID,
}: {
  label: string;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const inner = (
    <View style={[styles.rowInner, isLast ? null : styles.rowDivider]}>
      <Text style={styles.rowTitle}>{label}</Text>
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

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.bottomNavPadding },
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
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  savePressable: {
    minWidth: 56,
    minHeight: 32,
    justifyContent: 'center',
  },
  saveInner: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveInnerDisabled: {
    backgroundColor: colors.panelStrong,
  },
  saveInnerEnabled: {
    backgroundColor: colors.pink,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveTextDisabled: {
    color: colors.textMuted,
  },
  saveTextEnabled: {
    color: colors.text,
  },
  body: {
    paddingHorizontal: spacing.pageX,
    paddingTop: 6,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
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
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: { opacity: 0.72 },
});