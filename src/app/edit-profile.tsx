import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getImageAsset } from '@/data/imageAssets';
import { pickAvatarFromLibrary } from '@/services/avatarPickerService';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import type { UserProfile } from '@/types/mixology';
import { resolveAvatarSource } from '@/utils/profileFeed';

// 预设头像：3 个调酒师/酒吧图 + 鸡尾酒图
const presetAvatarKeys = [
  'avatarOne',
  'avatarTwo',
  'avatarThree',
  'margarita',
  'mojito',
  'negroni',
  'ginTonic',
  'oldFashioned',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useMixology();
  const [draft, setDraft] = useState<UserProfile>(userProfile);
  const [saving, setSaving] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const dirty =
    draft.nickname !== userProfile.nickname ||
    draft.avatarKey !== userProfile.avatarKey ||
    draft.avatarUri !== userProfile.avatarUri ||
    draft.signature !== userProfile.signature ||
    draft.city !== userProfile.city;

  const handleSave = async () => {
    if (!dirty || saving) {
      return;
    }
    if (!draft.nickname.trim()) {
      Alert.alert('提示', '昵称不能为空');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({
        ...draft,
        nickname: draft.nickname.trim(),
        signature: draft.signature.trim(),
        city: draft.city.trim(),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handlePickFromLibrary = async () => {
    const uri = await pickAvatarFromLibrary();
    if (uri) {
      setDraft((current) => ({ ...current, avatarUri: uri }));
      setAvatarLoadFailed(false);
    }
  };

  const avatarSource = avatarLoadFailed ? getImageAsset('avatarOne') : resolveAvatarSource(draft);

  return (
    <ScreenShell>
      {/* 顶行：取消 / 标题 / 保存 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.topButton} testID="edit-cancel-button">
          <X color={colors.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>编辑资料</Text>
        <Pressable onPress={handleSave} disabled={!dirty || saving} style={styles.topButton} testID="edit-save-button">
          <Check color={dirty ? colors.pink : colors.textMuted} size={24} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 当前头像 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            <Image testID="edit-avatar-preview" source={avatarSource} style={styles.avatarPreview} onError={() => setAvatarLoadFailed(true)} />
          </View>
          <Pressable onPress={handlePickFromLibrary} style={styles.uploadButton} testID="upload-avatar-button">
            <ImagePlus color={colors.pink} size={16} />
            <Text style={styles.uploadText}>从相册上传</Text>
          </Pressable>
        </View>

        {/* 预设头像网格 */}
        <Text style={styles.sectionLabel}>选择预设头像</Text>
        <View style={styles.presetGrid}>
          {presetAvatarKeys.map((key) => {
            const selected = !draft.avatarUri && draft.avatarKey === key;
            return (
              <Pressable
                key={key}
                onPress={() => setDraft((current) => ({ ...current, avatarKey: key, avatarUri: null }))}
                style={[styles.presetItem, selected ? styles.presetItemSelected : null]}
                testID={`preset-avatar-${key}`}
              >
                <Image source={getImageAsset(key)} style={styles.presetImage} />
              </Pressable>
            );
          })}
        </View>

        {/* 昵称 */}
        <Text style={styles.sectionLabel}>昵称</Text>
        <TextInput
          value={draft.nickname}
          onChangeText={(nickname) => setDraft((current) => ({ ...current, nickname }))}
          maxLength={16}
          placeholder="给自己起个名字"
          placeholderTextColor="#806f79"
          style={styles.input}
          testID="nickname-input"
        />

        {/* 签名 */}
        <Text style={styles.sectionLabel}>个性签名</Text>
        <View>
          <TextInput
            value={draft.signature}
            onChangeText={(signature) => setDraft((current) => ({ ...current, signature }))}
            maxLength={60}
            multiline
            placeholder="写一句你的喝酒宣言..."
            placeholderTextColor="#806f79"
            style={[styles.input, styles.signatureInput]}
            testID="signature-input"
          />
          <Text style={styles.counter}>{draft.signature.length}/60</Text>
        </View>

        {/* 城市 */}
        <Text style={styles.sectionLabel}>所在城市</Text>
        <TextInput
          value={draft.city}
          onChangeText={(city) => setDraft((current) => ({ ...current, city }))}
          maxLength={12}
          placeholder="如：上海"
          placeholderTextColor="#806f79"
          style={styles.input}
          testID="city-input"
        />

        <Pressable onPress={handleSave} disabled={!dirty || saving} style={[styles.saveButton, (!dirty || saving) && styles.saveButtonDisabled]}>
          <LinearGradient colors={dirty ? gradients.cta : gradients.card} style={styles.saveGradient}>
            <Text style={styles.saveText}>{saving ? '保存中...' : '保存'}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.pink,
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  uploadButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
    paddingHorizontal: 16,
  },
  uploadText: {
    color: colors.pink,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetItem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.panel,
  },
  presetItemSelected: {
    borderColor: colors.pink,
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signatureInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  counter: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  saveButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: 26,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
});
