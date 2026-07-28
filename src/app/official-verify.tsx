import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft } from 'lucide-react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing, touchTarget } from '@/styles/mixologyTheme';

const OFFICIAL_TYPES = ['个人职业资质', '机构', '企业'];

export default function OfficialVerifyScreen() {
  const router = useRouter();
  const { accountSecurity, verifyOfficial } = useMixology();

  const [selected, setSelected] = useState(
    accountSecurity.officialVerified ? accountSecurity.officialType : OFFICIAL_TYPES[0]
  );

  return (
    <ScreenShell padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/account-security' as Href)}
            style={({ pressed }) => [styles.headerSidePressable, pressed ? styles.pressed : null]}
            testID="official-back-button"
          >
            <View style={styles.headerSideInner}>
              <ChevronLeft color={colors.text} size={26} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>官方认证</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>

        <View style={styles.body}>
          {accountSecurity.officialVerified ? (
            <View style={styles.verifiedCard}>
              <Text style={styles.verifiedTitle}>已通过官方认证</Text>
              <Text style={styles.verifiedType}>{accountSecurity.officialType}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>选择你的认证类型，提交资质材料后等待审核。</Text>
              {OFFICIAL_TYPES.map((type) => {
                const active = selected === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setSelected(type)}
                    style={({ pressed }) => [styles.optionPressable, pressed ? styles.pressed : null]}
                    testID={`official-option-${type}`}
                  >
                    <View style={styles.optionInner}>
                      <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>
                        {type}
                      </Text>
                      <View
                        style={[
                          styles.radio,
                          active ? styles.radioActive : null,
                        ]}
                      >
                        {active ? <Check color="#ffffff" size={14} /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => verifyOfficial(selected)}
                style={({ pressed }) => [styles.buttonPressable, pressed ? styles.pressed : null]}
                testID="official-submit"
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>提交认证</Text>
                </View>
              </Pressable>
            </>
          )}
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
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  optionPressable: {
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextActive: {
    color: colors.pink,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    backgroundColor: colors.pink,
    borderColor: colors.pink,
  },
  buttonPressable: {
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonInner: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedCard: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.lg,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  verifiedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedType: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.72,
  },
});
