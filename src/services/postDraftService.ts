import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PostDraft } from '@/types/mixology';

const POST_DRAFT_KEY = 'mixology.postDraft';

export const defaultPostDraft: PostDraft = {
  title: '',
  body: '',
  images: [],
  topics: [],
  visibility: 'public',
  allowComments: true,
  savedAt: '',
};

export async function loadPostDraft(): Promise<PostDraft | null> {
  let rawValue: string | null;

  try {
    rawValue = await AsyncStorage.getItem(POST_DRAFT_KEY);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PostDraft>;
    // 没有任何实质内容的草稿视为无效
    if (!parsed.title?.trim() && !parsed.body?.trim() && !(parsed.images?.length)) {
      return null;
    }
    return { ...defaultPostDraft, ...parsed };
  } catch {
    return null;
  }
}

export async function savePostDraft(draft: PostDraft) {
  try {
    await AsyncStorage.setItem(POST_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Keep the prototype usable when native storage is unavailable in Expo Go.
  }
}

export async function clearPostDraft() {
  try {
    await AsyncStorage.removeItem(POST_DRAFT_KEY);
  } catch {
    // Keep the prototype usable when native storage is unavailable in Expo Go.
  }
}
