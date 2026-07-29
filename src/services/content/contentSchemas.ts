import { z } from 'zod';

export const CONTENT_CACHE_SCHEMA_VERSION = 1;

export const appContentRouteSchema = z.enum([
  '/ai',
  '/recipes',
  '/bars',
  '/drink-knowledge',
  '/blind-box',
  '/cellar',
]);

const imageFields = {
  imageKey: z.string().min(1),
  imageUrl: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), {
      message: 'imageUrl must use HTTP or HTTPS',
    })
    .nullable()
    .optional(),
};

export const ingredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    'base',
    'liqueur',
    'citrus',
    'mixer',
    'sweetener',
    'garnish',
    'tool',
  ]),
});

export const cocktailIngredientSchema = ingredientSchema.extend({
  amount: z.string().min(1),
});

export const recipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  englishName: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()),
  ingredients: z.array(cocktailIngredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  ...imageFields,
  difficulty: z.enum(['入门', '进阶', '专业']),
  prepMinutes: z.number().int().nonnegative(),
});

export const heroSlideSchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  scriptLabel: z.string(),
  ctaLabel: z.string(),
  ...imageFields,
  targetRoute: appContentRouteSchema,
});

export const homeShortcutSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  icon: z.enum(['box', 'book', 'cards', 'cellar']),
  route: appContentRouteSchema,
});

export const barMenuItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageKey: z.string().min(1),
  likes: z.number().int().nonnegative(),
  badge: z.string().nullable().optional(),
});

export const barReviewSchema = z.object({
  id: z.string().min(1),
  authorName: z.string().min(1),
  authorAvatarKey: z.string().min(1),
  text: z.string().min(1),
  date: z.string().min(1),
  likes: z.number().int().nonnegative(),
  imageKeys: z.array(z.string()).optional(),
});

export const barSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ...imageFields,
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  averageSpend: z.number().int().nonnegative(),
  distanceLabel: z.string(),
  metroHint: z.string(),
  address: z.string(),
  openHours: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  tasteScore: z.number().min(0).max(5),
  environmentScore: z.number().min(0).max(5),
  serviceScore: z.number().min(0).max(5),
  phone: z.string(),
  menu: z.array(barMenuItemSchema),
  reviews: z.array(barReviewSchema),
});

export const knowledgeSchema = z.object({
  id: z.string().min(1),
  recipeId: z.string().nullable().optional(),
  name: z.string().min(1),
  englishName: z.string().min(1),
  ...imageFields,
  era: z.string().min(1),
  meaning: z.string().min(1),
  story: z.string().min(1),
  symbols: z.array(z.string()),
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const ingredientListSchema = z.object({
  items: z.array(ingredientSchema),
  pagination: paginationSchema,
});

export const recipeListSchema = z.object({
  items: z.array(recipeSchema),
  pagination: paginationSchema,
});

export const barListSchema = z.object({
  items: z.array(barSchema),
  pagination: paginationSchema,
});

export const knowledgeListSchema = z.object({
  items: z.array(knowledgeSchema),
  pagination: paginationSchema,
});

export const homeResponseSchema = z.object({
  banners: z.array(heroSlideSchema),
  shortcuts: z.array(homeShortcutSchema),
  featuredRecipes: z.array(recipeSchema),
  featuredBars: z.array(barSchema),
});

export const contentSnapshotSchema = z.object({
  ingredients: z.array(ingredientSchema),
  recipes: z.array(recipeSchema),
  bars: z.array(barSchema),
  knowledge: z.array(knowledgeSchema),
  banners: z.array(heroSlideSchema),
  shortcuts: z.array(homeShortcutSchema),
});

export const contentCacheSchema = z.object({
  schemaVersion: z.literal(CONTENT_CACHE_SCHEMA_VERSION),
  fetchedAt: z.string().datetime(),
  payload: contentSnapshotSchema,
});

export type ContentSnapshot = z.infer<typeof contentSnapshotSchema>;
export type ContentCache = z.infer<typeof contentCacheSchema>;
