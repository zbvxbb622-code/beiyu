import type { z } from 'zod';

import {
  barListSchema,
  contentSnapshotSchema,
  homeResponseSchema,
  ingredientListSchema,
  knowledgeListSchema,
  recipeListSchema,
  type ContentSnapshot,
} from '@/services/content/contentSchemas';

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type ApiClientOptions = {
  apiBaseUrl: string;
  fetch: FetchLike;
  timeoutMs: number;
};

function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+/i.test(normalized)) {
    throw new Error('invalid-api-url');
  }
  return normalized;
}

async function readJson<Schema extends z.ZodType>(
  options: ApiClientOptions,
  path: string,
  schema: Schema
): Promise<z.output<Schema>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await options.fetch(`${normalizeApiBaseUrl(options.apiBaseUrl)}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`content-api-${response.status}`);
    }
    return schema.parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchContentSnapshot(
  options: ApiClientOptions
): Promise<ContentSnapshot> {
  const [home, ingredientList, recipeList, barList, knowledgeList] = await Promise.all([
    readJson(options, '/api/v1/home', homeResponseSchema),
    readJson(options, '/api/v1/ingredients?page=1&pageSize=100', ingredientListSchema),
    readJson(options, '/api/v1/recipes?page=1&pageSize=100', recipeListSchema),
    readJson(options, '/api/v1/bars?page=1&pageSize=100', barListSchema),
    readJson(options, '/api/v1/knowledge?page=1&pageSize=100', knowledgeListSchema),
  ]);

  return contentSnapshotSchema.parse({
    ingredients: ingredientList.items,
    recipes: recipeList.items,
    bars: barList.items,
    knowledge: knowledgeList.items,
    banners: home.banners,
    shortcuts: home.shortcuts,
  });
}
