import { z } from 'zod';

export const communityPostImageSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('asset'),
    assetKey: z.string(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('uri'),
    uri: z.string(),
  }),
]);

export const communityCommentSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  authorAvatarKey: z.string(),
  text: z.string(),
  date: z.string(),
});

export const communityPostSchema = z.object({
  id: z.string(),
  category: z.enum(['recommended', 'following', 'nearby']),
  title: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorAvatarKey: z.string(),
  imageKey: z.string(),
  body: z.string(),
  date: z.string(),
  likes: z.number().int(),
  likedByMe: z.boolean().optional(),
  comments: z.array(communityCommentSchema),
  venueId: z.string().optional(),
  images: z.array(communityPostImageSchema).optional(),
  topics: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  allowComments: z.boolean().optional(),
});

export const communityPostListSchema = z.object({
  items: z.array(communityPostSchema),
});
