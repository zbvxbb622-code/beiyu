import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { clearPostDraft, defaultPostDraft, loadPostDraft, savePostDraft } from '../postDraftService';

describe('postDraftService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves and loads a draft roundtrip', async () => {
    await savePostDraft({
      ...defaultPostDraft,
      title: '草稿标题',
      body: '草稿正文',
      images: [{ id: 'img-1', kind: 'asset', assetKey: 'mojito' }],
      topics: ['调酒心得'],
      venueId: 'amor-fati',
      visibility: 'private',
      allowComments: false,
      savedAt: '2026-07-21T00:00:00.000Z',
    });

    const draft = await loadPostDraft();
    expect(draft?.title).toBe('草稿标题');
    expect(draft?.body).toBe('草稿正文');
    expect(draft?.images).toEqual([{ id: 'img-1', kind: 'asset', assetKey: 'mojito' }]);
    expect(draft?.topics).toEqual(['调酒心得']);
    expect(draft?.venueId).toBe('amor-fati');
    expect(draft?.visibility).toBe('private');
    expect(draft?.allowComments).toBe(false);
  });

  it('returns null when storage is empty, content is blank, or draft was cleared', async () => {
    expect(await loadPostDraft()).toBeNull();

    // 完全空白的草稿视为无效，不恢复
    await savePostDraft({ ...defaultPostDraft, savedAt: '2026-07-21T00:00:00.000Z' });
    expect(await loadPostDraft()).toBeNull();

    await savePostDraft({ ...defaultPostDraft, title: '有内容', savedAt: '2026-07-21T00:00:00.000Z' });
    expect(await loadPostDraft()).not.toBeNull();
    await clearPostDraft();
    expect(await loadPostDraft()).toBeNull();
  });
});
