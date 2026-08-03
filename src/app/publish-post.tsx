import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AtSign,
  ChevronRight,
  Globe,
  Hash,
  ImagePlus,
  Lock,
  MapPin,
  Mic,
  Plus,
  Settings2,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { getImageAsset, imageAssetKeys } from '@/data/imageAssets';
import { clearPostDraft, loadPostDraft, savePostDraft } from '@/services/postDraftService';
import { pickPostImagesFromLibrary } from '@/services/postImagePickerService';
import { useContent } from '@/state/ContentState';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import { resolvePostImageSource } from '@/utils/postImages';
import type { PostImage, PostVisibility } from '@/types/mixology';

const MAX_IMAGES = 9;

// 话题推荐（结合调酒场景，参考小红书发布页的联想话题）
const SUGGESTED_TOPICS = ['调酒心得', '居家调酒', '今夜微醺', '盲盒抽卡', '探店打卡', '威士忌', '鸡尾酒'];

const CONTENT_DECLARATION =
  '发布即表示你确认：内容为本人原创或已获授权，不涉及侵权、虚假营销或违法信息；含酒类内容时请理性饮酒、拒绝酒驾。平台保留对违规内容的处理权。';

export default function PublishPostScreen() {
  const router = useRouter();
  // 支持从其它页面（如盲盒抽卡）带参跳转，预填表单
  const params = useLocalSearchParams<{ from?: string; title?: string; body?: string; imageKey?: string }>();
  const { publishPost } = useMixology();
  const { snapshot } = useContent();
  const hasPrefill = Boolean(params.title || params.body || params.imageKey);

  const [title, setTitle] = useState(params.title ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [images, setImages] = useState<PostImage[]>(
    params.imageKey ? [{ id: 'prefill-cover', kind: 'asset', assetKey: params.imageKey }] : []
  );
  const [topics, setTopics] = useState<string[]>([]);
  const [venueId, setVenueId] = useState<string | undefined>();
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const imageSeq = useRef(0);

  const venues = snapshot.bars;
  const selectedVenue = venueId ? venues.find((venue) => venue.id === venueId) : undefined;
  const backHref = params.from === 'blind-box' ? '/blind-box' : '/community';

  // 无预填参数时恢复上次草稿
  useEffect(() => {
    if (hasPrefill) return;
    let isMounted = true;
    loadPostDraft().then((draft) => {
      if (!isMounted || !draft) return;
      setTitle(draft.title);
      setBody(draft.body);
      setImages(draft.images);
      setTopics(draft.topics);
      setVenueId(draft.venueId);
      setVisibility(draft.visibility);
      setAllowComments(draft.allowComments);
      setRestoredDraft(true);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextImageId = (prefix: string) => {
    imageSeq.current += 1;
    return `${prefix}-${imageSeq.current}`;
  };

  const addAssetImage = (assetKey: string) => {
    setImages((current) => {
      if (current.length >= MAX_IMAGES) return current;
      // 同一张图库图不重复添加
      if (current.some((image) => image.kind === 'asset' && image.assetKey === assetKey)) return current;
      return [...current, { id: nextImageId('asset'), kind: 'asset', assetKey }];
    });
  };

  const removeImage = (id: string) => {
    setImages((current) => current.filter((image) => image.id !== id));
  };

  const handlePickFromLibrary = async () => {
    const uris = await pickPostImagesFromLibrary(MAX_IMAGES - images.length);
    if (!uris.length) return;
    setImages((current) => [
      ...current,
      ...uris.slice(0, MAX_IMAGES - current.length).map((uri) => ({ id: nextImageId('uri'), kind: 'uri', uri }) as PostImage),
    ]);
  };

  const toggleTopic = (topic: string) => {
    setTopics((current) => (current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]));
  };

  const handleDiscardDraft = async () => {
    await clearPostDraft();
    setRestoredDraft(false);
    setTitle('');
    setBody('');
    setImages([]);
    setTopics([]);
    setVenueId(undefined);
    setVisibility('public');
    setAllowComments(true);
  };

  const handleSaveDraft = async () => {
    if (!title.trim() && !body.trim() && !images.length) {
      Alert.alert('提示', '还没有可保存的内容');
      return;
    }
    await savePostDraft({
      title,
      body,
      images,
      topics,
      venueId,
      visibility,
      allowComments,
      savedAt: new Date().toISOString(),
    });
    Alert.alert('草稿已保存', '下次打开发布页会自动恢复');
    router.replace(backHref);
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请填写标题');
      return;
    }
    if (!body.trim()) {
      Alert.alert('提示', '请填写正文');
      return;
    }
    setSubmitting(true);
    try {
      await publishPost({ title, body, images, topics, venueId, visibility, allowComments });
      await clearPostDraft();
      router.replace('/community');
    } catch (e) {
      Alert.alert('发布失败', e instanceof Error ? e.message : '请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell>
      <TopBar title="发布笔记" backHref={backHref} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 图片行：缩略图 + 虚线添加框（参考小红书发布页） */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
          {images.map((image) => (
            <View key={image.id} style={styles.thumbWrap}>
              <Image testID={`image-thumb-${image.id}`} source={resolvePostImageSource(image)} style={styles.thumb} />
              <Pressable testID={`remove-image-${image.id}`} onPress={() => removeImage(image.id)} style={styles.thumbRemove} hitSlop={6}>
                <X color={colors.text} size={12} />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES ? (
            <Pressable testID="add-image-button" onPress={() => setShowImagePanel((v) => !v)} style={styles.addImageBox}>
              <Plus color={colors.textMuted} size={26} />
            </Pressable>
          ) : null}
        </ScrollView>
        <Text style={styles.imageHint}>{images.length}/{MAX_IMAGES} 张 · 第一张为封面</Text>

        {/* 图片来源面板：相册上传（真机）+ 内置图库多选 */}
        {showImagePanel ? (
          <View style={styles.imagePanel}>
            <Pressable testID="pick-from-library" onPress={handlePickFromLibrary} style={styles.libraryButton}>
              <ImagePlus color={colors.pink} size={18} />
              <Text style={styles.libraryButtonText}>从相册上传（真机）</Text>
            </Pressable>
            <Text style={styles.panelLabel}>内置图库（可多选）</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {imageAssetKeys.slice(0, 18).map((key) => {
                const selected = images.some((image) => image.kind === 'asset' && image.assetKey === key);
                return (
                  <Pressable key={key} testID={`gallery-image-${key}`} onPress={() => addAssetImage(key)}>
                    <Image source={getImageAsset(key)} style={[styles.galleryImage, selected && styles.galleryImageActive]} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* 添加标题 */}
        <TextInput
          testID="title-input"
          placeholder="添加标题"
          placeholderTextColor={colors.textMuted}
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          maxLength={40}
        />

        {/* 添加正文（右侧语音按钮占位） */}
        <View style={styles.bodyRow}>
          <TextInput
            testID="body-input"
            placeholder="添加正文"
            placeholderTextColor={colors.textMuted}
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />
          <Pressable onPress={() => Alert.alert('提示', '语音输入即将上线')} style={styles.micButton} hitSlop={8}>
            <Mic color={colors.textMuted} size={20} />
          </Pressable>
        </View>

        {/* 话题推荐 chips */}
        <View style={styles.topicCloud}>
          {SUGGESTED_TOPICS.map((topic) => {
            const active = topics.includes(topic);
            return (
              <Pressable key={topic} testID={`topic-chip-${topic}`} onPress={() => toggleTopic(topic)} style={[styles.topicChip, active && styles.topicChipActive]}>
                <Text style={[styles.topicChipText, active && styles.topicChipTextActive]}>#{topic}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 快捷动作 chips */}
        <View style={styles.actionRow}>
          <Pressable onPress={() => setBody((text) => `${text}#`)} style={styles.actionChip}>
            <Hash color={colors.textSoft} size={15} />
            <Text style={styles.actionChipText}>话题</Text>
          </Pressable>
          <Pressable onPress={() => setBody((text) => `${text}@`)} style={styles.actionChip}>
            <AtSign color={colors.textSoft} size={15} />
            <Text style={styles.actionChipText}>用户</Text>
          </Pressable>
        </View>

        {restoredDraft ? (
          <View style={styles.draftBanner}>
            <Text style={styles.draftBannerText}>已恢复上次未发布的草稿</Text>
            <Pressable testID="discard-draft" onPress={handleDiscardDraft} hitSlop={8}>
              <Text style={styles.draftBannerAction}>删除草稿</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* 标记地点（关联酒吧） */}
        <Pressable testID="venue-row" onPress={() => setShowVenuePicker((v) => !v)} style={styles.settingRow}>
          <MapPin color={colors.textSoft} size={20} />
          <Text style={styles.settingText}>标记地点</Text>
          <Text style={styles.settingValue} numberOfLines={1}>{selectedVenue?.name ?? ''}</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
        {showVenuePicker ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.venueChips}>
            {venues.map((venue) => {
              const active = venueId === venue.id;
              return (
                <Pressable
                  key={venue.id}
                  testID={`venue-chip-${venue.id}`}
                  onPress={() => setVenueId(active ? undefined : venue.id)}
                  style={[styles.venueChip, active && styles.venueChipActive]}>
                  <Text style={[styles.venueChipText, active && styles.venueChipTextActive]} numberOfLines={1}>{venue.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 公开可见 */}
        <Pressable
          testID="visibility-row"
          onPress={() => setVisibility((v) => (v === 'public' ? 'private' : 'public'))}
          style={styles.settingRow}>
          {visibility === 'public' ? <Globe color={colors.textSoft} size={20} /> : <Lock color={colors.amber} size={20} />}
          <Text style={styles.settingText}>{visibility === 'public' ? '公开可见' : '仅自己可见'}</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>

        {/* 高级选项 */}
        <Pressable testID="advanced-row" onPress={() => setShowAdvanced((v) => !v)} style={styles.settingRow}>
          <Settings2 color={colors.textSoft} size={20} />
          <Text style={styles.settingText}>高级选项</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
        {showAdvanced ? (
          <View style={styles.advancedPanel}>
            <Text style={styles.advancedText}>允许评论</Text>
            <Switch
              testID="allow-comments-switch"
              value={allowComments}
              onValueChange={setAllowComments}
              trackColor={{ false: colors.panelStrong, true: colors.pinkDark }}
              thumbColor={allowComments ? colors.pink : colors.textMuted}
            />
          </View>
        ) : null}

        {/* 笔记内容声明 */}
        <Pressable testID="declaration-row" onPress={() => Alert.alert('笔记内容声明', CONTENT_DECLARATION)} style={styles.declarationRow}>
          <Text style={styles.declarationText}>笔记内容声明</Text>
          <ChevronRight color={colors.textMuted} size={14} />
        </Pressable>
      </ScrollView>

      {/* 底部：存草稿 + 发布笔记 */}
      <View style={styles.bottomBar}>
        <Pressable testID="draft-button" onPress={handleSaveDraft} style={styles.draftButton}>
          <Text style={styles.draftButtonText}>存草稿</Text>
        </Pressable>
        <Pressable testID="publish-button" onPress={handlePublish} disabled={submitting} style={styles.publishButton}>
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishGradient}>
            <Text style={styles.publishText}>{submitting ? '发布中...' : '发布笔记'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
    paddingTop: 4,
  },
  // 图片行
  imageRow: {
    gap: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  addImageBox: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  imagePanel: {
    marginTop: 10,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    gap: 10,
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,47,159,0.10)',
    justifyContent: 'center',
  },
  libraryButtonText: {
    color: colors.pink,
    fontSize: 14,
    fontWeight: '800',
  },
  panelLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  galleryImage: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    marginRight: 8,
    backgroundColor: colors.bg,
  },
  galleryImageActive: {
    borderWidth: 2,
    borderColor: colors.pink,
    opacity: 0.6,
  },
  // 标题 / 正文
  titleInput: {
    minHeight: 52,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bodyInput: {
    flex: 1,
    minHeight: 120,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 8,
  },
  micButton: {
    paddingTop: 10,
  },
  // 话题
  topicCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.panelStrong,
  },
  topicChipActive: {
    backgroundColor: 'rgba(255,47,159,0.16)',
    borderWidth: 1,
    borderColor: colors.pink,
  },
  topicChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  topicChipTextActive: {
    color: colors.pink,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.panelStrong,
  },
  actionChipText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,184,77,0.10)',
  },
  draftBannerText: {
    color: colors.amber,
    fontSize: 13,
  },
  draftBannerAction: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 16,
  },
  // 设置行
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingText: {
    color: colors.textSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  settingValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 13,
  },
  venueChips: {
    gap: 8,
    paddingVertical: 10,
  },
  venueChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.panelStrong,
    maxWidth: 180,
  },
  venueChipActive: {
    backgroundColor: 'rgba(255,47,159,0.16)',
    borderWidth: 1,
    borderColor: colors.pink,
  },
  venueChipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  venueChipTextActive: {
    color: colors.pink,
    fontWeight: '700',
  },
  advancedPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  advancedText: {
    color: colors.textSoft,
    fontSize: 14,
  },
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
  },
  declarationText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  // 底部按钮
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: 'rgba(7,0,4,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  draftButton: {
    minWidth: 108,
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  publishButton: {
    flex: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  publishGradient: {
    minHeight: 50,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
});
