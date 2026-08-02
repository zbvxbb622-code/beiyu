import { describe, expect, it } from '@jest/globals';

import { resolvePostImageSource } from '@/utils/postImages';

describe('post image utilities', () => {
  it('resolves remote media images from their public URL', () => {
    expect(resolvePostImageSource({
      id: 'media-1',
      kind: 'remote',
      mediaId: 'upload-1',
      url: 'https://cdn.example.test/community/upload-1.jpg',
    })).toEqual({ uri: 'https://cdn.example.test/community/upload-1.jpg' });
  });
});
